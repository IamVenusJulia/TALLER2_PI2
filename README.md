# Ejecución con Docker

Este proyecto permite levantar el frontend, backend y base de datos PostgreSQL usando Docker Compose.

## Requisitos

- Docker Desktop
- Docker Compose

## Estructura Docker

El proyecto contiene los siguientes archivos principales para Docker:

- `frontend/Dockerfile`: configuración del contenedor del frontend.
- `backend/Dockerfile`: configuración del contenedor del backend.
- `docker-compose.yml`: archivo que orquesta los servicios de frontend, backend y PostgreSQL.

## Levantar el proyecto

Desde la raíz del proyecto, donde se encuentra el archivo `docker-compose.yml`, ejecutar:

```bash
docker compose up --build 