from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
import logging
from app.auth import get_current_user, RoleChecker

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

# Escenario 2: Endpoint exclusivo de Administrador protegido con RBAC
require_admin = RoleChecker(["admin"])

@app.get("/api/admin/reservas-semana")
def get_admin_reservas(current_user: dict = Depends(require_admin)):
    return {
        "message": "Panel de administración - Reservas de la semana",
        "admin_info": current_user
    }