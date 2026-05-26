import logging
import time
import json
import unicodedata# Para la función de remover acentos de forma limpia
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
from enum import Enum

# función para remover acentos y eñes de forma limpia 
def remover_acentos(texto: str) -> str:
    """Remueve tildes y eñes de forma limpia para cumplir con el estándar ASCII de HTTP"""
    return unicodedata.normalize('NFKD', texto).encode('ASCII', 'ignore').decode('ASCII')

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
origins = [
    "https://footcall-frontend.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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


# Escenario 1 y 4: Endpoint protegido para Clientes (con conexión a la base de datos real)
@app.get("/api/cliente/historial")
def get_cliente_historial(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    try:
        # El ID ya viene resuelto como BIGINT desde get_current_user gracias al auto-registro
        usuario_id = current_user.get("id")
        
        # En caso de fallback de emergencia donde el id es un UUID en string, intentamos buscar por email
        if isinstance(usuario_id, str):
            query_user = text("SELECT id FROM usuarios WHERE email = :email AND eliminado = FALSE")
            user_res = db.execute(query_user, {"email": current_user.get("email")}).fetchone()
            if user_res:
                usuario_id = user_res.id
            else:
                return {
                    "message": "Historial de reservas obtenido con éxito",
                    "usuario_autenticado": current_user,
                    "reservas": []
                }
        
        # Query de reservas reales del cliente
        query_reservas = text("""
            SELECT r.id AS reserva_id, r.fecha_reserva, r.total_pago, r.metodo_pago, r.estado,
                   c.nombre AS cancha, c.tipo_superficie AS superficie,
                   hc.hora_inicio, hc.hora_fin
            FROM reservas r
            JOIN horarios_cancha hc ON r.horario_cancha_id = hc.id
            JOIN canchas c ON hc.cancha_id = c.id
            WHERE r.usuario_id = :usuario_id
            ORDER BY r.fecha_reserva DESC, r.id DESC;
        """)
        
        result = db.execute(query_reservas, {"usuario_id": usuario_id}).mappings().all()
        
        reservas_lista = []
        for row in result:
            row_dict = dict(row)
            # Formatear objetos de fecha y hora a strings
            if row_dict.get("fecha_reserva"):
                row_dict["fecha"] = str(row_dict["fecha_reserva"])
            if row_dict.get("hora_inicio"):
                row_dict["hora_inicio"] = str(row_dict["hora_inicio"])[:5]
            if row_dict.get("hora_fin"):
                row_dict["hora_fin"] = str(row_dict["hora_fin"])[:5]
            if row_dict.get("total_pago"):
                row_dict["total_pago"] = float(row_dict["total_pago"])
            reservas_lista.append(row_dict)
            
        return {
            "message": "Historial de reservas obtenido con éxito",
            "usuario_autenticado": {
                "id": current_user["id"],
                "nombre": f"{user_res.nombre} {user_res.apellido}",
                "rol": current_user["rol"]
            },
            "reservas": reservas_lista
        }
    except Exception as e:
        logger.error(f"Error cargando historial de reservas: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error cargando historial: {str(e)}"
        )

# Escenario 2: Endpoint Panel de Administrador (con conexión a la base de datos real)
require_admin = RoleChecker(["admin"])

@app.get("/api/admin/reservas-semana")
def get_admin_reservas(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    try:
        # 1. Obtener canchas disponibles
        query_canchas = text("""
            SELECT id AS cancha_id, nombre, tipo_superficie, precio_por_hora 
            FROM canchas 
            WHERE esta_activa = TRUE AND eliminado = FALSE;
        """)
        canchas_result = db.execute(query_canchas).mappings().all()
        canchas_lista = []
        for row in canchas_result:
            row_dict = dict(row)
            if row_dict.get("precio_por_hora"):
                row_dict["precio_por_hora"] = float(row_dict["precio_por_hora"])
            canchas_lista.append(row_dict)

        # 2. Obtener reservas activas (con el nombre completo del cliente)
        query_reservas = text("""
            SELECT r.id AS reserva_id, 
                   CONCAT(u.nombre, ' ', u.apellido) AS cliente_nombre,
                   hc.cancha_id,
                   r.fecha_reserva AS fecha,
                   hc.hora_inicio,
                   r.estado
            FROM reservas r
            JOIN usuarios u ON r.usuario_id = u.id
            JOIN horarios_cancha hc ON r.horario_cancha_id = hc.id
            WHERE u.eliminado = FALSE
            ORDER BY r.fecha_reserva ASC, hc.hora_inicio ASC;
        """)
        reservas_result = db.execute(query_reservas).mappings().all()
        reservas_lista = []
        for row in reservas_result:
            row_dict = dict(row)
            if row_dict.get("fecha"):
                row_dict["fecha"] = str(row_dict["fecha"])
            if row_dict.get("hora_inicio"):
                row_dict["hora_inicio"] = str(row_dict["hora_inicio"])[:5]
            reservas_lista.append(row_dict)

        return {
            "admin": {
                "nombre": current_user.get("nombre") or "Administrador"
            },
            "canchas_disponibles": canchas_lista,
            "reservas_activas": reservas_lista
        }
    except Exception as e:
        logger.error(f"Error cargando reservas de administracion: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error cargando reservas: {str(e)}"
        )

@app.get("/api/admin/clientes")
def get_admin_clientes(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    try:
        query = text("""
            SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.fecha_creacion,
                   COUNT(r.id) AS total_reservas
            FROM usuarios u
            LEFT JOIN reservas r ON u.id = r.usuario_id
            WHERE u.rol = 'cliente' AND u.eliminado = FALSE
            GROUP BY u.id
            ORDER BY u.nombre ASC, u.apellido ASC;
        """)
        result = db.execute(query).mappings().all()
        clientes_lista = []
        for row in result:
            row_dict = dict(row)
            if row_dict.get("fecha_creacion"):
                row_dict["fecha_creacion"] = str(row_dict["fecha_creacion"])[:10]
            clientes_lista.append(row_dict)
        return {"clientes": clientes_lista}
    except Exception as e:
        logger.error(f"Error cargando lista de clientes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error cargando clientes: {str(e)}"
        )
# HU-18 - Modelo de validación para cambio de estado
class EstadoReservaEnum(str, Enum):
    confirmada = "confirmada"
    pendiente = "pendiente"
    cancelada = "cancelada"
class ActualizarEstadoReserva(BaseModel):
    estado: EstadoReservaEnum

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

# HU-18 - Endpoint para actualizar estado de reserva (solo admin)
@app.patch("/api/admin/reservas/{reserva_id}/estado", response_model=dict)
def cambiar_estado_reserva(
    reserva_id: int,
    payload: ActualizarEstadoReserva,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)# usa el validador de roles existente para asegurar que solo los admins puedan acceder a este endpoint
):
    """
    HU-18: Endpoint para cambiar el estado de una reserva. El middleware 'require_admin' 
    lanzará automáticamente un 403 Forbidden si el usuario no es administrador.
    """
    try:
        # 1. Verificar si la reserva existe usando SQL Nativo en Supabase
        query_buscar = text("SELECT id, estado FROM reservas WHERE id = :id")
        reserva = db.execute(query_buscar, {"id": reserva_id}).fetchone()

        if not reserva:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"La reserva con ID {reserva_id} no existe en el sistema."
            )

        # 2. Actualizar el estado y guardar los cambios transaccionales
        query_actualizar = text("""
            UPDATE reservas 
            SET estado = :nuevo_estado, updated_at = NOW() 
            WHERE id = :id
            RETURNING id, usuario_id, horario_cancha_id, fecha_reserva, estado, total_pago;
        """)
        
        resultado = db.execute(
            query_actualizar, 
            {"nuevo_estado": payload.estado.value, "id": reserva_id}
        )
        db.commit()

        reserva_actualizada = resultado.fetchone()

        return {
            "message": "Estado de la reserva actualizado con éxito",
            "reserva": {
                "id": reserva_actualizada.id,
                "usuario_id": reserva_actualizada.usuario_id,
                "horario_cancha_id": reserva_actualizada.horario_cancha_id,
                "fecha_reserva": str(reserva_actualizada.fecha_reserva),
                "estado": payload.estado.value,  # Retorna el valor string de forma limpia
                "total_pago": float(reserva_actualizada.total_pago)
            }
        }
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        db.rollback()
        logger.error(f"Error actualizando el estado de la reserva {reserva_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno en la actualización: {str(e)}"
        )
    
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
security_optional = HTTPBearer(auto_error=False)

# ENDPOINT PRINCIPAL
@app.post("/api/voice/process", status_code=status.HTTP_200_OK)
async def process_voice_input(
    payload: SolicitudVoz,
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional)
):
   """
    Endpoint: Recibe la transcripción de texto, procesa la intención con Gemini y retorna audio.
    Valida disponibilidad e inserta la reserva automáticamente si esta libre (HU-19)
    """
   try:
        inicio_procesamiento = time.time()
        
        texto_real = payload.texto_transcrito.strip()
        nombre_usuario = payload.usuario.nombre

        # HU-23 (Filtro IA Responsable)
        # Lista básica de palabras ofensivas comunes para mitigar ataques o lenguaje obsceno
        PALABRAS_PROHIBIDAS = ["gonorrea", "triplehp", "malparido", "carechimba", "hijo de puta", "mierda"]
        if any(palabra in texto_real.lower() for palabra in PALABRAS_PROHIBIDAS):
            logger.warning(f"HU-23: Intento de uso de lenguaje inapropiado por: {nombre_usuario}")
            
            texto_bloqueo = f"Lo siento {nombre_usuario}, no puedo procesar tu solicitud utilizando ese lenguaje. Por favor intenta de nuevo con respeto."
            tts_error = gTTS(text=texto_bloqueo, lang='es', tld='com', slow=False)
            err_buffer = BytesIO()
            tts_error.write_to_fp(err_buffer)
            err_bytes = err_buffer.getvalue()
            err_buffer.close()
            
            # Guardamos el intento de abuso en los logs de la DB
            try:
                db.execute(text("""
                    INSERT INTO logs_conversaciones (session_id, texto_usuario, texto_respuesta, error_transcripcion, detalles_error, fecha_registro)
                    VALUES ('session_voice_api', :texto, :resp, TRUE, 'Filtro de lenguaje ofensivo activado', NOW());
                """), {"texto": texto_real, "resp": texto_bloqueo})
                db.commit()
            except Exception:
                pass

            return Response(
                content=err_bytes,
                media_type="audio/mpeg",
                headers={
                    "X-Transcription": "Bloqueado por seguridad",
                    "X-Intent": "desconocido",
                    "X-Assistant-Text": "Solicitud rechazada por lenguaje ofensivo",
                    "Access-Control-Expose-Headers": "X-Transcription, X-Intent, X-Assistant-Text",
                    "Content-Length": str(len(err_bytes))
                }
            )
        
        logger.info(f"Procesando solicitud de: {nombre_usuario} ({payload.usuario.rol}) | Texto: '{texto_real}'")        

        # contexto temporal dinnámico 
        ahora = datetime.now()
        fecha_hoy = ahora.strftime("%Y-%m-%d")  # Ej: '2026-05-24'
        
        # Mapeo rápido para tener el nombre del día en español para Gemini
        dias_es = {"Monday": "Lunes", "Tuesday": "Martes", "Wednesday": "Miércoles", "Thursday": "Jueves", "Friday": "Viernes", "Saturday": "Sábado", "Sunday": "Domingo"}
        nombre_dia_hoy = dias_es.get(ahora.strftime("%A"), ahora.strftime("%A"))
        
        # Inyección dinámica de la fecha en las instrucciones del sistema
        prompt_sistema_dinamico = f"""
        Actúas como el asistente virtual inteligente de FootCall, una app de reservas deportivas de fútbol 5.
        Tu única tarea es analizar el texto transcrito del usuario y extraer los parámetros de su intención de reserva.

        CONTEXTO TEMPORAL CRÍTICO:
        - La fecha de HOY real es estrictamente: {fecha_hoy} (Día de la semana: {nombre_dia_hoy}).
        - CUALQUIER REFERENCIA RELATIVA COMO "ESTE LUNES" DEBE CALCULARSE EN EL AÑO EN CURSO ({ahora.year}).
        - ESTÁ TOTALMENTE PROHIBIDO RESPONDER O CALCULAR FECHAS EN LOS AÑOS 2023,2024 O 2025. Si hoy es {fecha_hoy}, el lunes más cercano es en mayo de 2026.
        - Cualquier referencia relativa del usuario como "este lunes", "mañana", "el próximo miércoles" o "las tres de la tarde" debe ser calculada matemáticamente basándote en que hoy es {fecha_hoy}. No uses años pasados como 2024 o 2025.

        REGLAS CRÍTICAS:
        1. Sé estrictamente determinista. No inventes datos.
        2. Formatea las fechas calculadas a YYYY-MM-DD.
        3. Formatea las horas a formato de 24 horas (HH:MM).
        4. Para el campo 'deporte', extrae ÚNICAMENTE el tipo de superficie si el usuario la menciona ('sintética' o 'natural'). Si dice 'fútbol 5' o no la especifica, déjalo como null.
        """
        # Llamada al LLM enviándole la configuración con el prompt dinámico montado en caliente
        response_llm = gemini_client.models.generate_content(
            model=MODELO_GEMINI,
            contents=f"Texto del usuario: '{texto_real}'",
            # AQUÍ PASAMOS EL PROMPT DINÁMICO QUE ACABAMOS DE CONSTRUIR
            config=types.GenerateContentConfig(
                system_instruction=prompt_sistema_dinamico,
                temperature=0.0,
                max_output_tokens=500,
                response_mime_type="application/json",
                response_schema=IntencionReserva,
            )
        )
        
        intencion_extraida = json.loads(response_llm.text)

        # EXTRAER METADATA DE TOKENS - Métricas y Evaluación del Sistema (HU-11 / RÚBRICA)
        tokens_input = 0
        tokens_output = 0

        if response_llm.usage_metadata:
            tokens_input = response_llm.usage_metadata.prompt_token_count
            tokens_output = response_llm.usage_metadata.candidates_token_count
            logger.info(f" Consumo Gemini - Input Tokens: {tokens_input} | Output Tokens: {tokens_output}")

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
        
        # validación de parametros mínimos antes de proceder con la consulta de disponibilidad
        if intencion_extraida.get("intencion") in ["crear_reserva", "consultar_disponibilidad"] and fecha_str and hora_str:
            fecha_obj = datetime.strptime(fecha_str, "%Y-%m-%d")
            dia_semana_num = int(fecha_obj.strftime("%w"))

            # # CORRECCIÓN: Se cambió 'c.precio_hora' por 'c.precio_por_hora' para que coincida exactamente con tu tabla 'canchas'
            query_sql = text("""
                SELECT c.id AS cancha_id, c.nombre AS cancha_nombre, c.tipo_superficie, c.precio_por_hora,
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
                
                # HU-19: Si la intención extraída del LLM es guardar una reserva y encontramos disponibilidad, procedemos con el INSERT
                if intencion_extraida.get("intencion") == "crear_reserva":
                    # # Tomamos la primera cancha disponible de la lista devuelta por la consulta
                    cancha_elegida = disponibilidad_canchas[0]
                    
                    # Intentamos obtener el usuario autenticado a partir del token si se envió
                    usuario_id = None
                    if credentials:
                        try:
                            from app.auth import get_current_user
                            current_user = get_current_user(credentials, db)
                            usuario_id = current_user.get("id")
                            # Si es un string (fallback de emergencia), buscamos en la DB por su email
                            if isinstance(usuario_id, str):
                                query_user_auth = text("SELECT id FROM usuarios WHERE email = :email LIMIT 1")
                                user_auth_res = db.execute(query_user_auth, {"email": current_user.get("email")}).fetchone()
                                usuario_id = user_auth_res.id if user_auth_res else None
                        except Exception as auth_err:
                            logger.error(f"Error autenticando en proceso de voz: {auth_err}")
                    
                    # Si no está autenticado (ej: tests) o no se encontró en la base de datos, buscamos por nombre
                    if not usuario_id or isinstance(usuario_id, str):
                        query_user = text("SELECT id FROM usuarios WHERE nombre ILIKE :nombre LIMIT 1")
                        user_res = db.execute(query_user, {"nombre": nombre_usuario}).fetchone()
                        usuario_id = user_res.id if user_res else 1
                    
                    try:
                        # Ejecutamos el INSERT transaccional usando los datos mapeados y 'precio_por_hora' como total_pago
                        query_insert_reserva = text("""
                            INSERT INTO reservas (usuario_id, horario_cancha_id, fecha_reserva, estado, total_pago, metodo_pago, fecha_creacion, updated_at)
                            VALUES (:usuario_id, :horario_cancha_id, :fecha_reserva, 'pendiente', :total_pago, 'efectivo', NOW(), NOW());
                        """)
                        
                        db.execute(query_insert_reserva, {
                            "usuario_id": usuario_id,
                            "horario_cancha_id": cancha_elegida["horario_id"],
                            "fecha_reserva": datetime.strptime(fecha_str, "%Y-%m-%d").date(),
                            "total_pago": float(cancha_elegida["precio_por_hora"])
                        })
                        db.commit() # Guardamos la reserva en Supabase de manera persistente
                        
                        # Modificamos el texto para informarle al usuario que su reserva quedó registrada exitosamente
                        texto_asistente = f"¡Excelente {nombre_usuario}! He registrado tu reserva para la cancha {cancha_elegida['cancha_nombre']} el dia {fecha_str} a las {hora_str} en estado pendiente."
                        logger.info(f"HU-19: Reserva guardada en DB exitosamente para el usuario ID {usuario_id}")
                        
                    except Exception as db_err:
                        db.rollback() # Revertimos cambios si falla la escritura
                        logger.error(f"Error en insercion HU-19: {str(db_err)}")
                        texto_asistente = f"Lo siento {nombre_usuario}, tuvimos un problema interno al guardar tu reserva."                
                
                #  HU-19: Si la intención era solo una consulta, solo responder con la disponibilidad encontrada
                else:
                    if len(canchas_nombres) == 1:
                        texto_asistente = f"{saludo_inicial} Tengo libre la cancha {canchas_nombres[0]} para esa fecha a las {hora_str}. ¿Procedemos con la reserva?"
                    else:
                        opciones_str = " y la ".join(canchas_nombres)
                        texto_asistente = f"{saludo_inicial} Para esa fecha a las {hora_str} tengo disponibles la {opciones_str}. ¿Cual prefieres?"
        else:
            texto_asistente = f"Entendido {nombre_usuario}. ¿En que mas te puedo colaborar?"      

        # Síntesis de testo a voz (TTS)
        tts = gTTS(text=texto_asistente, lang='es', tld='com', slow=False)
        audio_buffer = BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_bytes = audio_buffer.getvalue()
        audio_buffer.close()

        # Limpiar acentos y caracteres especiales de los textos para los headers HTTP si coordino con front puedo mejorar esto usando urllib.parse.quote
        texto_real_limpio = remover_acentos(texto_real)
        texto_asistente_limpio = remover_acentos(texto_asistente)

        fin_procesamiento = time.time()
        latencia_total = int((fin_procesamiento - inicio_procesamiento) * 1000)
        logger.info(f"Procesamiento completado con éxito en {latencia_total}ms")

        # HU-20 (Persistencia de Logs en Supabase)
        try:
            # Intentamos asociar el log a un usuario real si existe en la base de datos
            query_log_user = text("SELECT id FROM usuarios WHERE nombre ILIKE :nombre LIMIT 1")
            log_user_res = db.execute(query_log_user, {"nombre": nombre_usuario}).fetchone()
            log_usuario_id = log_user_res.id if log_user_res else None
            
            # Insertamos la telemetría exacta requerida por la HU-20 en tu tabla 'logs_conversaciones'
            query_insert_log = text("""
                INSERT INTO logs_conversaciones (
                    usuario_id, session_id, texto_usuario, texto_respuesta, 
                    latencia_total_ms, error_transcripcion, tokens_input, tokens_output, fecha_registro
                ) VALUES (
                    :usuario_id, :session_id, :texto_usuario, :texto_respuesta, 
                    :latencia_total, FALSE, :tokens_input, :tokens_output, NOW()
                );
            """)
            
            db.execute(query_insert_log,{
                "usuario_id": log_usuario_id,
                "session_id": "session_voice_api",
                "texto_usuario": texto_real,
                "texto_respuesta": texto_asistente,
                "latencia_total": latencia_total,
                "tokens_input": tokens_input,
                "tokens_output": tokens_output
            })
            db.commit()
            logger.info("HU-20: Telemetría e historial de conversación guardados con éxito en Supabase.")
        except Exception as log_err:
            db.rollback()
            # No frenamos la respuesta del usuario si el log falla, solo lo registramos en consola
            logger.error(f"Error guardando telemetría HU-20: {str(log_err)}")

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
        try:
            query_insert_err_log = text("""
                INSERT INTO logs_conversaciones (
                    session_id, texto_usuario, error_transcripcion, detalles_error, fecha_registro
                ) VALUES ('session_voice_api', :texto_usuario, TRUE, :detalles_error, NOW());
            """)
            db.execute(query_insert_err_log, {
                "texto_usuario": payload.texto_transcrito if 'payload' in locals() else "Desconocido",
                "detalles_error": str(e)
            })
            db.commit()
        except Exception as inner_err:
            logger.error(f"No se pudo guardar el log de error en la DB: {str(inner_err)}")
        
        logger.error(f"Error procesando la solicitud de voz: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno: {str(e)}"
        )