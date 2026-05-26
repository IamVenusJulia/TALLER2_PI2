# tests/test_main.py
import pytest
import jwt
import os
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

# Forzamos un secreto estático de QA antes de importar la app para que auth.py lo tome con certeza
SECRET_TEST = "secreto_super_seguro_de_prueba_para_qa_123"
os.environ["SUPABASE_JWT_SECRET"] = SECRET_TEST

import app.auth
app.auth.JWT_SECRET = SECRET_TEST  # Parche directo para evitar fallos de entorno

from app.main import app
from app.database import get_db
from app.auth import get_current_user, RoleChecker

client = TestClient(app)

# FIXTURES Y MOCKS GLOBALES
@pytest.fixture(autouse=True)
def mock_db_dependency():
    """Bypass controlado a la base de datos, manteniendo activas las funciones de seguridad"""
    mock_session = MagicMock()
    # Simula que la consulta de disponibilidad de canchas devuelve un registro libre
    mock_session.execute.return_value.mappings.return_value.all.return_value = [
        {"cancha_id": 1, "cancha_nombre": "Maracaná Sintética", "tipo_superficie": "sintética", "horario_id": 10, "hora_inicio": "18:00"}
    ]
    # Forzamos a que la consulta de usuario de auth.py no devuelva nada para obligar a usar el Fallback del JWT
    mock_session.execute.return_value.fetchone.return_value = None
    
    app.dependency_overrides[get_db] = lambda: mock_session
    yield
    app.dependency_overrides.clear()

# 1. PRUEBAS DE LA RAÍZ Y HEALTH CHECK
def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "project": "FootCall"}

def test_health_check_success():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"



# 2. PRUEBAS ESPECÍFICAS PARA SUBIR LA COBERTURA DE APP/AUTH.PY (QA)
def test_auth_missing_credentials():
    """Escenario 3: Petición sin cabecera de autorización (Falla con 403 por HTTPBearer)"""
    response = client.get("/api/cliente/historial")
    assert response.status_code == 403

def test_auth_invalid_jwt_token():
    """Escenario 3: Envío de un token corrupto o mal formado (InvalidTokenError)"""
    headers = {"Authorization": "Bearer token-completamente-invalido-y-corrupto"}
    response = client.get("/api/cliente/historial", headers=headers) # ¡Corregido: Añadidos los headers!
    assert response.status_code == 401
    assert "Token de autenticación inválido." in response.json()["detail"]

def test_auth_expired_jwt_token():
    """Escenario 3: Envío de un token JWT cuya fecha ya expiró (ExpiredSignatureError)"""
    payload_expirado = {"sub": "123", "email": "test@univalle.edu.co", "exp": 0}
    token_expirado = jwt.encode(payload_expirado, SECRET_TEST, algorithm="HS256")
    
    headers = {"Authorization": f"Bearer {token_expirado}"}
    response = client.get("/api/cliente/historial", headers=headers)
    assert response.status_code == 401
    assert "El token ha expirado." in response.json()["detail"]

def test_auth_fallback_jwt_success():
    """Escenario 4: Token válido de cliente procesado mediante el Fallback del JWT"""
    payload_valido = {
        "sub": "usr_999",
        "email": "camilo@univalle.edu.co",
        "user_metadata": {"full_name": "Camilo Andres", "rol": "cliente"}
    }
    token_valido = jwt.encode(payload_valido, SECRET_TEST, algorithm="HS256")
    
    headers = {"Authorization": f"Bearer {token_valido}"}
    response = client.get("/api/cliente/historial", headers=headers)
    
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["message"] == "Historial de reservas obtenido con éxito"
    assert json_data["usuario_autenticado"]["id"] == "usr_999"
    assert json_data["usuario_autenticado"]["rol"] == "cliente"

def test_rbac_admin_access_denied_for_cliente():
    """Escenario 2: Validar que un usuario con rol 'cliente' no pueda entrar a rutas de 'admin'"""
    payload_cliente = {
        "sub": "usr_111",
        "email": "cliente@test.com",
        "user_metadata": {"full_name": "Usuario Cliente", "rol": "cliente"}
    }
    token_cliente = jwt.encode(payload_cliente, SECRET_TEST, algorithm="HS256")
    
    headers = {"Authorization": f"Bearer {token_cliente}"}
    response = client.get("/api/admin/reservas-semana", headers=headers)
    
    assert response.status_code == 403
    assert "No tienes los permisos requeridos para esta acción." in response.json()["detail"]

def test_rbac_admin_access_success():
    """Escenario 2: Validar que un usuario con rol 'admin' sí ingrese con éxito"""
    payload_admin = {
        "sub": "usr_000",
        "email": "admin@test.com",
        "user_metadata": {"full_name": "Administrador Principal", "rol": "admin"}
    }
    token_admin = jwt.encode(payload_admin, SECRET_TEST, algorithm="HS256")
    
    headers = {"Authorization": f"Bearer {token_admin}"}
    response = client.get("/api/admin/reservas-semana", headers=headers)
    
    assert response.status_code == 200
    assert "Panel de administración - Reservas de la semana" in response.json()["message"]



# 3. PRUEBA OPTIMIZADA (Sprint 2): Core de Voz con Entrada JSON
@patch("app.main.gemini_client.models.generate_content")
def test_process_voice_input_success(mock_gemini):
    """Prueba el flujo optimizado: Recibe JSON -> LLM Texto -> TTS gTTS"""
    mock_response_llm = MagicMock()
    mock_response_llm.text = '{"intencion": "crear_reserva", "deporte": "sintética", "fecha": "2026-05-18", "hora": "18:00", "respuesta_asistente": "Perfecto"}'
    mock_gemini.return_value = mock_response_llm
    
    payload = {
        "usuario": {
            "nombre": "Camilo Andres",
            "rol": "cliente"
        },
        "texto_transcrito": "Quiero reservar una cancha sintética mañana a las 6 de la tarde"
    }
    
    response = client.post("/api/voice/process", json=payload)
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert "X-Transcription" in response.headers
    assert "X-Intent" in response.headers
    assert response.headers["X-Intent"] == "crear_reserva"

# 4. PRUEBA DE IA RESPONSABLE (HU-23)
def test_process_voice_input_offensive_language():
    """Valida que el filtro de la HU-23 intercepte insultos y bloquee la petición sin ir al LLM"""
    payload_ofensivo = {
        "usuario": {
            "nombre": "Carlos Andres",
            "rol": "cliente"
        },
        "texto_transcrito": "Hola carechimba, jueputa necesito reservar una cancha"
    }
    
    response = client.post("/api/voice/process", json=payload_ofensivo)
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.headers["X-Transcription"] == "Bloqueado por seguridad"
    assert response.headers["X-Intent"] == "desconocido"