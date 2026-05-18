from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
import logging
from app.auth import get_current_user, RoleChecker
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import Optional
from io import BytesIO
from fastapi.responses import StreamingResponse


# Configuración de logs para ver la verificación en la terminal
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="FootCall API",
    description="Backend orquestador para el asistente de voz de reservas deportivas",
    version="0.1.0"
)

@app.on_event("startup")
def startup_event():
    # Prueba de conexión automática al iniciar el servidor
    try:
        db = next(get_db())
        db.execute(text("SELECT 1"))
        logger.info("¡Conexión exitosa con la instancia de Supabase establecida!")
    except Exception as e:
        logger.error(f"Error conectando a Supabase al iniciar: {e}")

@app.get("/")
def read_root():
    return {"status": "ok", "project": "FootCall"}

@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        # Consulta de verificación para el endpoint de salud
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": "error", "details": str(e)}

# Escenario 1 y 4: Endpoint protegido para Clientes e inyección de contexto
@app.get("/api/cliente/historial")
def get_cliente_historial(current_user: dict = Depends(get_current_user)):
    return {
        "message": "Historial de reservas obtenido con éxito",
        "usuario_autenticado": current_user
    }

# Escenario 2: Endpoint exclusivo de Administrador protegido con RBAC (Control de Acceso Basado en Roles).
require_admin = RoleChecker(["admin"])

@app.get("/api/admin/reservas-semana")
def get_admin_reservas(current_user: dict = Depends(require_admin)):
    return {
        "message": "Panel de administración - Reservas de la semana",
        "admin_info": current_user
    }

# HU-09: CORE DE INTELIGENCIA DE VOZ (STT - Speech to Text)

# Inicializamos el cliente oficial de Google GenAI SDK
gemini_client = genai.Client()
# Definimos el modelo multimodal de Gemini a utilizar para el asistente
MODELO_GEMINI = "gemini-2.5-flash"

# Definimos la configuración para cumplir con el Punto 11 del Taller (Métricas y Control)
CONFIG_IA = types.GenerateContentConfig(
    temperature=0.0,            # Determinista para evitar respuestas locas en las reservas
    max_output_tokens=1000,     # Control y límite de consumo de tokens (Evita costos altos)
)

# HU-10 (Estructura de Extracción)
class IntencionReserva(BaseModel):
    intencion: str = Field(description="La acción del usuario. Valores posibles: 'crear_reserva', 'cancelar_reserva', 'consultar_disponibilidad', 'desconocido'")
    deporte: Optional[str] = Field(None, description="El tipo de cancha o grama de fútbol 5. Valores posibles: 'sintética', 'natural'. Si no se menciona, dejar null.")
    fecha: Optional[str] = Field(None, description="La fecha solicitada en formato YYYY-MM-DD. Si dice 'mañana', calcula la fecha basada en la fecha actual del sistema. Si no se menciona, dejar null.")
    hora: Optional[str] = Field(None, description="La hora solicitada en formato HH:MM (24 horas). Ejemplo: '3 pm' es '15:00'. Si no se menciona, dejar null.")
    respuesta_asistente: Optional[str] = Field(None, description="Una frase inicial corta y cortés de máximo 4 palabras reconociendo la acción. Ejemplo: '¡Claro que sí!', 'Perfecto, déjame revisar.'")

# System Prompt estricto para cumplir con el Criterio 3 (Políticas de negocio)
PROMPT_SISTEMA_LLM = """
Actúas como el asistente virtual inteligente de FootCall, una app de reservas deportivas de fútbol 5.
Tu única tarea es analizar el texto transcrito del usuario y extraer los parámetros de su intención de reserva.

REGLAS CRÍTICAS:
1. Sé estrictamente determinista. No inventes datos. Si el usuario no menciona el deporte, la fecha o la hora, ponlos como null.
2. Formatea las fechas a YYYY-MM-DD. Ten en cuenta que la fecha actual simulada del sistema es Domingo 17 de Mayo de 2026. Por ende, 'mañana' es '2026-05-18'.
3. Formatea las horas a formato de 24 horas (HH:MM). Ejemplo: '6 de la tarde' -> '18:00', '3 pm' -> '15:00'.
"""

# Configuración avanzada para el LLM de la HU-10
CONFIG_LLM_INTENCIONES = types.GenerateContentConfig(
    system_instruction=PROMPT_SISTEMA_LLM,
    temperature=0.0,
    max_output_tokens=500,
    response_mime_type="application/json", # Obliga a Gemini a responder en JSON
    response_schema=IntencionReserva,      # Mapea el JSON exactamente a nuestra clase de Pydantic
)

@app.post("/api/voice/process", status_code=status.HTTP_200_OK)
async def process_voice_input(
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db),# creamos la sesión de base de datos para la HU-10
    #current_user: dict = Depends(get_current_user) # protegido con autenticación y el uso de middleware de la HU-06
    # si se desea hacer untes desde el Swagge se debe dejar comentada esta línea y descomentarla para pruebas con autenticación real desde el frontend   
):
    """
    Endpoint para recibir archivos de audio (.wav, .mp3, .webm),
    transcribirlos a texto usando IA (STT) y procesar la intención del usuario.
    """
    # Criterio 1: validar formatos comunes de audio admitidos
    formatos_permitidos = ["audio/wav", "audio/mpeg", "audio/webm", "audio/x-wav", "application/octet-stream"]
    if audio_file.content_type not in formatos_permitidos and not audio_file.filename.endswith(('.wav', '.mp3', '.webm')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato de archivo no soportado ({audio_file.content_type}). Solo se admiten archivos .wav, .mp3 o .webm"
        )
        
    try:
        import time
        import json # Llamamos el json para formatear la respuesta del LLM
        from datetime import datetime # Para procesar el día de la semana en la HU-10
        inicio_stt = time.time()
        
        # Leemos el archivo de audio real enviado por el usuario
        audio_bytes = await audio_file.read()
        tamano_kb = len(audio_bytes) / 1024
        
        # LOG informativo en consola para comprobar que el archivo llegó completo
        logger.info(f"Audio recibido: {audio_file.filename} | Tamaño: {tamano_kb:.2f} KB | Tipo: {audio_file.content_type}")
        
        # LLAMADA REAL A LA IA DE GEMINI (STT Nativo e inmediato)
        response = gemini_client.models.generate_content(
            model=MODELO_GEMINI,
            contents=[
                types.Part.from_bytes(
                    data=audio_bytes,
                    mime_type=audio_file.content_type if audio_file.content_type != "application/octet-stream" else "audio/wav"
                ),
                "Transcribe de manera exacta y literal el audio adjunto al idioma español neutro. No agregues comentarios, solo devuelve el texto escuchado."
            ]
            , config=CONFIG_IA # control de temperatura y tokens
        )
        
        texto_real = response.text.strip()
        fin_stt = time.time()
        latencia_total = int((fin_stt - inicio_stt) * 1000)
        
        # Extraemos los metadatos de consumo que nos entrega la API de Google (Punto 11 del Taller)
        tokens_input = response.usage_metadata.prompt_token_count if response.usage_metadata else 0
        tokens_output = response.usage_metadata.candidates_token_count if response.usage_metadata else 0
        tokens_totales = response.usage_metadata.total_token_count if response.usage_metadata else 0

        # Procesamiento del LLM: Extracción de Intenciones y Parámetros de Reserva desde el texto transcrito al LLM con el System Prompt y el esquema estructurado HU-10
        response_llm = gemini_client.models.generate_content(
            model=MODELO_GEMINI,
            contents=f"Texto del usuario: '{texto_real}'",
            config=CONFIG_LLM_INTENCIONES
        )
        
        # Obligamos a Gemini a responder en JSON estructurado, cargamos su texto como diccionario HU-10
        intencion_extraida = json.loads(response_llm.text)

        # cosulta de disponibalidad de canchas para la fecha y hora solicitada
        disponibilidad_canchas = []
        fecha_str = intencion_extraida.get("fecha")
        hora_str = intencion_extraida.get("hora")

        # error de tildes en la respuesta del LLM
        superficie_raw = intencion_extraida.get("deporte")
        superficie_solicitada = None

        if superficie_raw:
            superficie_solicitada = superficie_raw.lower().strip()
            superficie_solicitada = (
                superficie_solicitada
                .replace("é", "e")
                .replace("á", "a")
                .replace("í", "i")
                .replace("ó", "o")
                .replace("ú", "u")
            )

        # Solo buscamos disponibilidad si el usuario quiere crear/consultar y tenemos fecha y hora
        if intencion_extraida.get("intencion") in ["crear_reserva", "consultar_disponibilidad"] and fecha_str and hora_str:
            
            # 1. Calcular el día de la semana (0=Domingo, 1=Lunes, ..., 6=Sábado) para PostgreSQL
            # %w en strftime de Python da 0 para Domingo, justo como tu CHECK (dia_semana BETWEEN 0 AND 6)
            fecha_obj = datetime.strptime(fecha_str, "%Y-%m-%d")
            dia_semana_num = int(fecha_obj.strftime("%w"))

            # 2. Query nativa para encontrar canchas con slot configurado y SIN reserva activa 
            query_sql = text("""
                SELECT c.id AS cancha_id, c.nombre AS cancha_nombre, c.tipo_superficie, hc.id AS horario_id, hc.hora_inicio
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

            # Ejecutamos la query pasando los parámetros limpios
            resultado = db.execute(query_sql, {
                "dia_semana": dia_semana_num,
                "hora": hora_str,
                "fecha": fecha_str,
                "superficie": superficie_solicitada
            }).mappings().all()

            # Mapeamos el resultado convirtiendo objetos 'time' a string para evitar el error de serialización
            disponibilidad_canchas = []
            for row in resultado:
                row_dict = dict(row)
                # Si 'hora_inicio' es un objeto time, lo pasamos a formato HH:MM:SS en texto
                if hasattr(row_dict.get("hora_inicio"), "strftime"):
                    row_dict["hora_inicio"] = row_dict["hora_inicio"].strftime("%H:%M:%S")
                disponibilidad_canchas.append(row_dict)

        # GENERACIÓN DE LA RESPUESTA CONVERSACIONAL HU-10 
        # Construimos la respuesta final de forma dinámica según los resultados reales de la base de datos
        saludo_inicial = intencion_extraida.get("respuesta_asistente") or "Listo."
        
        if intencion_extraida.get("intencion") in ["crear_reserva", "consultar_disponibilidad"]:
            if len(disponibilidad_canchas) == 0:
                texto_asistente = f"Lo siento, para el día {fecha_str} a las {hora_str} no nos quedan canchas disponibles."
            else:
                canchas_nombres = [c['cancha_nombre'] for c in disponibilidad_canchas]
                if len(canchas_nombres) == 1:
                    texto_asistente = f"{saludo_inicial} Tengo libre la cancha {canchas_nombres[0]} para mañana a las {hora_str}. ¿Procedemos con la reserva?"
                else:
                    # Si hay múltiples opciones disponibles, las unimos con "y la" para que suene natural: "la cancha A y la cancha B"
                    opciones_str = " y la ".join(canchas_nombres)
                    texto_asistente = f"{saludo_inicial} Para mañana a las {hora_str} tengo disponibles la {opciones_str}. ¿Cuál de las dos prefieres?"
        else:
            texto_asistente = "Entendido. ¿En qué más te puedo colaborar?"      

        # HU-11: SÍNTESIS DE RESPUESTA A VOZ (TTS)      
        from gtts import gTTS
        from fastapi import Response
        
        # 1. Creamos el objeto gTTS (Mantiene eñes y tildes originales para que la voz suene natural, luego normalizamos el texto para las cabeceras HTTP)
        tts = gTTS(text=texto_asistente, lang='es', tld='com', slow=False)
        
        # 2. Guardamos el audio en el buffer de memoria y extraemos sus bytes
        audio_buffer = BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_bytes = audio_buffer.getvalue()
        audio_buffer.close()

        # TEST LOCAL: Guardamos físicamente el archivo en el servidor para verificar que sí se genera el audio correctamente (eliminar esta parte cuando se este en producción)
        with open("respuesta_asistente.mp3", "wb") as f:
            f.write(audio_bytes)

        # NORMALIZACIÓN: Limpiamos tildes y eñes para evitar los símbolos raros (Ã©, Ã±)
        # con esto se busca asegura compatibilidad con servidores HTTP y Swagger
        texto_real_limpio = (
            texto_real.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
            .replace("ñ", "n").replace("Á", "A").replace("É", "E").replace("Í", "I").replace("Ó", "O").replace("Ú", "U").replace("Ñ", "N")
            .replace("¿", "").replace("?", "")
        )
        texto_asistente_limpio = (
            texto_asistente.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
            .replace("ñ", "n").replace("Á", "A").replace("É", "E").replace("Í", "I").replace("Ó", "O").replace("Ú", "U").replace("Ñ", "N")
            .replace("¿", "").replace("?", "")
        )

        # 3. Armamos las cabeceras con los strings
        headers = {
            "X-Transcription": texto_real_limpio,
            "X-Intent": str(intencion_extraida.get("intencion", "desconocido")),
            "X-Assistant-Text": texto_asistente_limpio,
            "Access-Control-Expose-Headers": "X-Transcription, X-Intent, X-Assistant-Text",
            "Content-Length": str(len(audio_bytes))
        }

        # 4. Retornamos los bytes puros con la metadata limpia
        return Response(
            content=audio_bytes, 
            media_type="audio/mpeg", 
            headers=headers
        )
        
    except Exception as e:
        logger.error(f"Error procesando el archivo de voz con Gemini: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno al procesar el flujo de audio con Gemini: {str(e)}"
        )