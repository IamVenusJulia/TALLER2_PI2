from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
import logging
from app.auth import get_current_user, RoleChecker
from google import genai
from google.genai import types

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

# Inicializamos el cliente de Gemini (usa la versión 1.67.0)
gemini_client = genai.Client()
MODELO_GEMINI = "gemini-2.5-flash"

# Definimos la configuración para cumplir con el Punto 11 del Taller (Métricas y Control)
CONFIG_IA = types.GenerateContentConfig(
    temperature=0.0,            # Determinista para evitar respuestas locas en las reservas
    max_output_tokens=1000,     # Control y límite de consumo de tokens (Evita costos altos)
)

@app.post("/api/voice/process", status_code=status.HTTP_200_OK)
async def process_voice_input(
    audio_file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user) # protegido con autenticación y el uso de middleware de la HU-06
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
        
        return {
            "status": "success",
            "filename": audio_file.filename,
            "size_kb": round(tamano_kb, 2),
            "transcription": texto_real,
            "metrics": {
                "latencia_stt_ms": latencia_total, # Valida Criterio 2 (<1000ms)
                "error_transcripcion": False,
                # variables en el JSON de respuesta
                "consumo_tokens": {
                    "input_tokens": tokens_input,
                    "output_tokens": tokens_output,
                    "total_tokens": tokens_totales
                },
                "costo_estimado_usd": round((tokens_totales * 0.000000075), 6) # Cálculo educativo de costo basado en precios de Gemini Flash                
            }
        }
        
    except Exception as e:
        logger.error(f"Error procesando el archivo de voz con Gemini: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno al procesar el flujo de audio con Gemini: {str(e)}"
        )