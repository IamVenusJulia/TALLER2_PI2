# tests/test_main.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from app.main import app
from app.database import get_db
from app.auth import get_current_user, RoleChecker

client = TestClient(app)

# CONFIGURACIÓN DE FIXTURES Y MOCKS GLOBALES (Para no romper la base de datos)
@pytest.fixture(autouse=True)
def mock_dependencies():
    """Bypassa la base de datos y la seguridad para probar solo la lógica del servidor"""
    # Mock de la sesión de Base de Datos
    mock_session = MagicMock()
    # Simula que la consulta SQL de disponibilidad devuelve una cancha libre
    mock_session.execute.return_value.mappings.return_value.all.return_value = [
        {"cancha_id": 1, "cancha_nombre": "Maracaná Sintética", "tipo_superficie": "sintética", "horario_id": 10, "hora_inicio": "18:00"}
    ]
    app.dependency_overrides[get_db] = lambda: mock_session
    
    # Mock de Autenticación de usuarios
    mock_user = {"id": "12345", "nombre": "Camilo Andres", "role": "cliente"}
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    yield
    # Limpia los overrides después de cada test
    app.dependency_overrides.clear()

 
# 1. PRUEBA: Raíz del Proyecto (Health Check básico) 
def test_read_root():
    """Valida el endpoint de bienvenida"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "project": "FootCall"}

def test_health_check_success():
    """Valida el estado de salud del servidor y conexión mockeada"""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

 
# 2. PRUEBA: Endpoint del Historial del Cliente (Escenario 1) 
def test_get_cliente_historial_success():
    """Valida la respuesta del historial con el usuario autenticado"""
    response = client.get("/api/cliente/historial")
    assert response.status_code == 200
    assert "usuario_autenticado" in response.json()
    assert response.json()["message"] == "Historial de reservas obtenido con éxito"

 
# 3. PRUEBA: Endpoint de Administración con RBAC (Escenario 2) 
def test_get_admin_reservas_success():
    """Valida el panel de admin forzando el bypass del RoleChecker"""
    # Forzamos temporalmente el rol de admin en la dependencia global
    from app.main import require_admin
    mock_admin = {"id": "999", "nombre": "Admin Principal", "role": "admin"}
    
    app.dependency_overrides[require_admin] = lambda: mock_admin

    response = client.get("/api/admin/reservas-semana")
    assert response.status_code == 200
    assert "message" in response.json()
    assert response.json()["message"] == "Panel de administración - Reservas de la semana"

 
# 4. PRUEBA: Core de Voz (HU-09, HU-10, HU-11) - Caso Exitoso Completo 
@patch("app.main.gemini_client.models.generate_content")
def test_process_voice_input_success(mock_gemini):
    """Prueba el flujo completo de Audio -> STT -> LLM -> TTS simulando Gemini"""
    
    # 1. Mockear la respuesta 1 de Gemini (STT - Transcripción)
    mock_response_stt = MagicMock()
    mock_response_stt.text = "Quiero reservar una cancha sintética mañana a las 6 de la tarde"
    mock_response_stt.usage_metadata.prompt_token_count = 150
    mock_response_stt.usage_metadata.candidates_token_count = 20
    mock_response_stt.usage_metadata.total_token_count = 170

    # 2. Mockear la respuesta 2 de Gemini (LLM - JSON Estructurado de Intenciones)
    mock_response_llm = MagicMock()
    mock_response_llm.text = '{"intencion": "crear_reserva", "deporte": "sintética", "fecha": "2026-05-18", "hora": "18:00", "respuesta_asistente": "Perfecto"}'
    
    # Corrección clave: side_effect en singular
    mock_gemini.side_effect = [mock_response_stt, mock_response_llm]
    
    # Enviamos un archivo binario de audio de prueba emulando tu frontend
    files = {"audio_file": ("test.mp3", b"fake-audio-binary-data", "audio/mpeg")}
    
    response = client.post("/api/voice/process", files=files)
    
    # Verificaciones críticas exigidas por la rúbrica y las HU
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert "X-Transcription" in response.headers
    assert "X-Intent" in response.headers
    assert "X-Assistant-Text" in response.headers
    assert response.headers["X-Intent"] == "crear_reserva"

 
# 5. PRUEBA: Manejo de Errores - Formato de archivo no soportado (QA Testing) 
def test_process_voice_input_invalid_format():
    """Valida que el servidor rechace archivos de texto o formatos no permitidos"""
    files = {"audio_file": ("documento.txt", b"texto plano", "text/plain")}
    
    response = client.post("/api/voice/process", files=files)
    
    assert response.status_code == 400
    assert "Formato de archivo no soportado" in response.json()["detail"]