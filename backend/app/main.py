import logging
import time
import json
from datetime import datetime

from fastapi import FastAPI, Depends, Response, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager

from sqlalchemy.orm import Session
from sqlalchemy import text

from pydantic import BaseModel, Field
from typing import Optional

from io import BytesIO

from app.database import get_db
from app.auth import get_current_user, RoleChecker

from google import genai
from google.genai import types

from gtts import gTTS

# 1. Configuración de logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 2. Definir el lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Código que se ejecuta al iniciar la aplicación 
    try:
        db = next(get_db())
        db.execute(text("SELECT 1"))
        logger.info("¡Conexión exitosa con la instancia de Supabase establecida!")
    except Exception as e:
        logger.error(f"Error conectando a Supabase al iniciar: {e}")
    
    yield   # Muy importante
    
    # Código que se ejecuta al apagar la aplicación 
    logger.info("Aplicación cerrándose correctamente...")


# 3. Crear la aplicación FastAPI con lifespan
app = FastAPI(
    title="FootCall API",
    description="Backend orquestador para el asistente de voz de reservas deportivas",
    version="0.1.0",
    lifespan=lifespan
)

# 4. Middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"status": "ok", "project": "FootCall"}


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": "error", "details": str(e)}


# Escenario 1 y 4: Endpoint protegido para Clientes
@app.get("/api/cliente/historial")
def get_cliente_historial(current_user: dict = Depends(get_current_user)):
    return {
        "message": "Historial de reservas obtenido con éxito",
        "usuario_autenticado": current_user
    }

# Escenario 2: Endpoint Panel de Administrador
require_admin = RoleChecker(["admin"])

@app.get("/api/admin/reservas-semana")
def get_admin_reservas(current_user: dict = Depends(require_admin)):
    return {
        "message": "Panel de administración - Reservas de la semana",
        "admin_info": current_user
    }

#  CONFIGURACIÓN GEMINI
gemini_client = genai.Client()
MODELO_GEMINI = "gemini-2.5-flash"


# Modelos Pydantic
class InfoUsuario(BaseModel):
    nombre: str
    rol: str = "cliente"


class SolicitudVoz(BaseModel):
    usuario: InfoUsuario
    texto_transcrito: str


class IntencionReserva(BaseModel):
    intencion: str = Field(description="La acción del usuario. Valores posibles: 'crear_reserva', 'cancelar_reserva', 'consultar_disponibilidad', 'desconocido'")
    deporte: Optional[str] = Field(None, description="El tipo de cancha o grama de fútbol 5.")
    fecha: Optional[str] = Field(None, description="La fecha solicitada en formato YYYY-MM-DD.")
    hora: Optional[str] = Field(None, description="La hora solicitada en formato HH:MM.")
    respuesta_asistente: Optional[str] = Field(None, description="Una frase inicial corta y cortés.")


# System Prompt
PROMPT_SISTEMA_LLM = """
Actúas como el asistente virtual inteligente de FootCall, una app de reservas deportivas de fútbol 5.
Tu única tarea es analizar el texto transcrito del usuario y extraer los parámetros de su intención de reserva.

REGLAS CRÍTICAS:
1. Sé estrictamente determinista. No inventes datos.
2. Formatea las fechas a YYYY-MM-DD.
3. Formatea las horas a formato de 24 horas (HH:MM).
"""

# Configuración del LLM
CONFIG_LLM_INTENCIONES = types.GenerateContentConfig(
    system_instruction=PROMPT_SISTEMA_LLM,
    temperature=0.0,
    max_output_tokens=500,
    response_mime_type="application/json",
    response_schema=IntencionReserva,
)

# ENDPOINT PRINCIPAL
@app.post("/api/voice/process", status_code=status.HTTP_200_OK)
async def process_voice_input(
    payload: SolicitudVoz,
    db: Session = Depends(get_db)
):
    """
    Endpoint: Recibe la transcripción de texto, procesa la intención con Gemini y retorna audio.
    """
    try:
        inicio_procesamiento = time.time()
        
        texto_real = payload.texto_transcrito.strip()
        nombre_usuario = payload.usuario.nombre
        
        logger.info(f"Procesando solicitud de: {nombre_usuario} ({payload.usuario.rol}) | Texto: '{texto_real}'")
        
        # Llamada al LLM
        response_llm = gemini_client.models.generate_content(
            model=MODELO_GEMINI,
            contents=f"Texto del usuario: '{texto_real}'",
            config=CONFIG_LLM_INTENCIONES
        )
        
        intencion_extraida = json.loads(response_llm.text)

        # Consulta de disponibilidad
        disponibilidad_canchas = []
        fecha_str = intencion_extraida.get("fecha")
        hora_str = intencion_extraida.get("hora")
        
        superficie_raw = intencion_extraida.get("deporte")
        superficie_solicitada = None

        if superficie_raw:
            superficie_solicitada = (
                superficie_raw.lower().strip()
                .replace("é", "e").replace("á", "a").replace("í", "i").replace("ó", "o").replace("ú", "u")
            )

        if intencion_extraida.get("intencion") in ["crear_reserva", "consultar_disponibilidad"] and fecha_str and hora_str:
            fecha_obj = datetime.strptime(fecha_str, "%Y-%m-%d")
            dia_semana_num = int(fecha_obj.strftime("%w"))

            query_sql = text("""
                SELECT c.id AS cancha_id, c.nombre AS cancha_nombre, c.tipo_superficie, 
                       hc.id AS horario_id, hc.hora_inicio
                FROM canchas c
                JOIN horarios_cancha hc ON c.id = hc.cancha_id
                WHERE hc.dia_semana = :dia_semana
                  AND hc.hora_inicio = :hora
                  AND c.esta_activa = TRUE
                  AND c.eliminado = FALSE
                  AND hc.activo = TRUE
                  AND (:superficie IS NULL OR c.tipo_superficie = CAST(:superficie AS tipo_superficie_enum))
                  AND NOT EXISTS (
                      SELECT 1 
                      FROM reservas r
                      WHERE r.horario_cancha_id = hc.id
                        AND r.fecha_reserva = :fecha
                        AND r.estado != 'cancelada'
                  );
            """)

            resultado = db.execute(query_sql, {
                "dia_semana": dia_semana_num,
                "hora": hora_str,
                "fecha": fecha_str,
                "superficie": superficie_solicitada
            }).mappings().all()

            for row in resultado:
                row_dict = dict(row)
                if hasattr(row_dict.get("hora_inicio"), "strftime"):
                    row_dict["hora_inicio"] = row_dict["hora_inicio"].strftime("%H:%M:%S")
                disponibilidad_canchas.append(row_dict)

        # Generación de respuesta conversacional
        saludo_inicial = intencion_extraida.get("respuesta_asistente") or "Listo."
        
        if intencion_extraida.get("intencion") in ["crear_reserva", "consultar_disponibilidad"]:
            if len(disponibilidad_canchas) == 0:
                texto_asistente = f"Lo siento {nombre_usuario}, para el dia {fecha_str} a las {hora_str} no nos quedan canchas disponibles."
            else:
                canchas_nombres = [c['cancha_nombre'] for c in disponibilidad_canchas]
                if len(canchas_nombres) == 1:
                    texto_asistente = f"{saludo_inicial} Tengo libre la cancha {canchas_nombres[0]} para esa fecha a las {hora_str}. ¿Procedemos con la reserva?"
                else:
                    opciones_str = " y la ".join(canchas_nombres)
                    texto_asistente = f"{saludo_inicial} Para esa fecha a las {hora_str} tengo disponibles la {opciones_str}. ¿Cual prefieres?"
        else:
            texto_asistente = f"Entendido {nombre_usuario}. ¿En que mas te puedo colaborar?"      

        # Síntesis de voz (TTS)
        tts = gTTS(text=texto_asistente, lang='es', tld='com', slow=False)
        audio_buffer = BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_bytes = audio_buffer.getvalue()
        audio_buffer.close()

        # Limpieza para cabeceras
        texto_real_limpio = (
            texto_real.replace("á", "a").replace("é", "e").replace("í", "i")
            .replace("ó", "o").replace("ú", "u").replace("ñ", "n")
            .replace("¿", "").replace("?", "")
        )
        texto_asistente_limpio = (
            texto_asistente.replace("á", "a").replace("é", "e").replace("í", "i")
            .replace("ó", "o").replace("ú", "u").replace("ñ", "n")
            .replace("¿", "").replace("?", "")
        )

        fin_procesamiento = time.time()
        latencia_total = int((fin_procesamiento - inicio_procesamiento) * 1000)
        logger.info(f"Procesamiento completado con éxito en {latencia_total}ms")

        headers = {
            "X-Transcription": texto_real_limpio,
            "X-Intent": str(intencion_extraida.get("intencion", "desconocido")),
            "X-Assistant-Text": texto_asistente_limpio,
            "Access-Control-Expose-Headers": "X-Transcription, X-Intent, X-Assistant-Text",
            "Content-Length": str(len(audio_bytes))
        }

        return Response(
            content=audio_bytes, 
            media_type="audio/mpeg", 
            headers=headers
        )
        
    except Exception as e:
        logger.error(f"Error procesando la solicitud de voz: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno: {str(e)}"
        )