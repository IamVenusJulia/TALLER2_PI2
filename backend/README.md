# FootCall - Backend

Este repositorio contiene el módulo **Backend (Orquestador API)** de FootCall, encargado de la lógica de negocio, integración con base de datos y el pipeline de Inteligencia de Voz para las reservas deportivas.

## 🚀 Stack Tecnológico

- **Framework:** FastAPI
- **Base de Datos:** PostgreSQL (Supabase)
- **Inteligencia Artificial:** Google GenAI SDK (Gemini 2.5-flash) - _Módulos de STT y LLM Estructurado_
- **Síntesis de Voz (TTS):** gTTS (Google Text-to-Speech)
- **QA & Testing:** Pytest con Pytest-Cov (Cobertura de Código)

## 👥 Integrantes del Grupo

| Integrante   | Rol                                                                           |
| ------------ | ----------------------------------------------------------------------------- |
| **Camilo**   | Backend & QA (Testing de cobertura y lógica de servidor)                      |
| **Daniel**   | Frontend & IA Lead (Interfaz web e Integración de servicios)                  |
| **Venus**    | DevOps & Cloud Architect (Docker, CI/CD y despliegue)                         |
| **Anderson** | Scrum Master & Data Specialist (Coordinación de tareas, BPMN y Base de Datos) |

## 🎯 Historias de Usuario Desarrolladas (Sprint 1)

- **HU-02:** Creación y configuración instancia en Supabase
- **HU-06:** Control de acceso y protección de endpoints por Roles (Clientes y Administradores).
- **HU-09:** Core de Inteligencia de Voz - Recepción de audio y Transcripción exacta (STT Nativo).
- **HU-10:** Extracción Estructurada de Intenciones (JSON) mediante Prompt de Sistema Determinista y consulta de disponibilidad de canchas en PostgreSQL.
- **HU-11:** Síntesis de Respuesta a Voz (TTS) y normalización de cabeceras HTTP expuestas para compatibilidad con el Frontend.

---

## 🛠️ Cómo Desplegar en Local

### ⚙️ Requisito Previo: Variables de Entorno

> **⚠️ Importante:** Antes de ejecutar el proyecto, solicita al equipo el archivo **`.env`** con las variables de entorno necesarias (claves de API, credenciales de Supabase, etc.) y colócalo en la raíz de la carpeta `/backend`. Sin este archivo el servidor **no funcionará**.

1. **Instalar Dependencias:**
   Abre tu terminal en la carpeta `/backend` y ejecuta:

```bash
   pip install -r requirements.txt
```

2. **Ejecutar el Servidor de Desarrollo:**
   Mediante el siguiente comando para levantar la API con recarga automática:

```bash
   uvicorn app.main:app --reload
```

La documentación interactiva de la API estará disponible de inmediato en http://localhost:8000/docs (Swagger UI).

## 🧪 Control de Calidad (QA & Testing)

Para garantizar la estabilidad del servicio, el proyecto cuenta con una suite de pruebas unitarias automatizadas que mockean las conexiones externas (Gemini/Supabase), permitiendo ejecuciones rápidas y deterministas.

Para ejecutar los test y generar el Reporte de Cobertura (Coverage), corre desde la raíz de `/backend`:

```bash
python -m pytest --cov=app tests/
```

📊 **Métrica Actual del Sprint:** 6/6 Tests Exitosos (Passed) | 73% Cobertura Total
