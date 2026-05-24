# FootCall - Backend

Este repositorio contiene el módulo **Backend (Orquestador API)** de FootCall, encargado de la lógica de negocio, integración con la base de datos de Supabase y el procesamiento estructurado de intenciones para las reservas deportivas.

## 🚀 Stack Tecnológico

- **Framework:** FastAPI
- **Base de Datos:** PostgreSQL (Supabase)
- **Inteligencia Artificial:** Google GenAI SDK (Gemini 2.5-flash) - _Extracción Estructurada de Intenciones (LLM)_
- **Síntesis de Voz (TTS):** gTTS (Google Text-to-Speech)
- **QA & Testing:** Pytest con Pytest-Cov (Cobertura de Código)

## 👥 Integrantes del Grupo

| Integrante   | Rol |
| ------------ | ----------------------------------------------------------------------------- |
| **Camilo** | Backend & QA (Testing de cobertura y lógica de servidor)                      |
| **Daniel** | Frontend & IA Lead (Interfaz web e Integración de servicios)                  |
| **Venus** | DevOps & Cloud Architect (Docker, CI/CD y despliegue)                          |
| **Anderson** | Scrum Master & Data Specialist (Coordinación de tareas, BPMN y Base de Datos) |

## 🎯 Historias de Usuario Desarrolladas (Sprint 1 - Refactorizado)

- **HU-02:** Creación y configuración de la instancia en Supabase.
- **HU-06:** Control de acceso y protección de endpoints por Roles (Clientes y Administradores).
- **HU-09:** Rediseño Arquitectural de Voz - Migración del procesamiento de audio al cliente vía **Web Speech API** (Frontend) para optimizar el rendimiento y costos del LLM.
- **HU-10:** Extracción Estructurada de Intenciones (JSON) a partir de texto plano mediante un Prompt de Sistema Determinista y consulta nativa de disponibilidad de canchas en PostgreSQL.
- **HU-11:** Síntesis de Respuesta a Voz (TTS) en el Backend y normalización de cabeceras HTTP expuestas para compatibilidad con el Frontend.

---

## 🛠️ Cómo Desplegar en Local

### ⚙️ Requisito Previo: Variables de Entorno

> **⚠️ Importante:** Antes de ejecutar el proyecto, coloca el archivo **`.env`** con las variables de entorno necesarias (claves de API, credenciales de Supabase, etc.) dentro de la carpeta `/backend`. Sin este archivo el servidor **no funcionará**.

1. **Instalar Dependencias:**
   Abre tu terminal en la raíz del proyecto y ejecuta:
   ```bash
   pip install -r backend/requirements.txt

2. **Ejecutar el Servidor de Desarrollo:**
   Mediante el siguiente comando para levantar la API con recarga automática desde la raíz del proyecto:

```bash
   uvicorn app.main:app --reload
```
** En caso de estar parado en otro lugar** del proyecto ejecuta el siguinte comando 

```bash
   uvicorn backend.app.main:app --reload
```

La documentación interactiva de la API estará disponible de inmediato en http://localhost:8000/docs (Swagger UI).

## 🧪 Control de Calidad (QA & Testing)

Para garantizar la estabilidad del servicio, el proyecto cuenta con una suite de pruebas unitarias automatizadas que simulan (mockean) las conexiones externas (Gemini/Supabase), permitiendo ejecuciones rápidas y deterministas en entornos locales y pipelines de CI/CD.

Para ejecutar los test y generar el Reporte de Cobertura (Coverage), corre desde la raíz de `/backend`:

```bash
python -m pytest --cov=app tests/
```
📊 **Métrica Actual del Sprint 1 (Post-Feedback):**
- **Tests Exitosos:** 9/9 Passed (100% éxito)
- **Cobertura `auth.py`:** 88%
- **Cobertura `main.py`:** 84%
- **Cobertura Total del Backend:** 84%
