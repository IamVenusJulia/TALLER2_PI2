# FootCall - Frontend

FootCall es el primer agente de voz especializado en la reserva, gestión y administración de partidos de fútbol 5. Este repositorio contiene exclusivamente el módulo **Frontend** (Next.js).

## Tecnologías Usadas
- **Framework:** Next.js 14 (App Router)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS
- **Autenticación:** Supabase Auth (Integrado en Sprint 1)
- **Fuente:** Inter (Google Fonts)

## Integrantes del Grupo
- **Daniel (Frontend Developer)**
- **Camilo (Backend Developer)**

## Estructura del Proyecto
```text
/frontend
 ├── /public          # Assets estáticos (LogoFinal.png, etc)
 ├── /src
 │    ├── /app        # Rutas de Next.js (login, admin, cliente)
 │    ├── /lib        # Configuración de clientes (Supabase, Mocks)
 │    └── /types      # Interfaces de TypeScript (Contratos JSON)
 └── tailwind.config.ts # Configuración de colores corporativos
```

## Cómo Desplegar en Local

1.  **Instalar dependencias:**
    Abre tu terminal en la carpeta `/frontend` y ejecuta:
    ```bash
    npm install
    ```

2.  **Configurar Variables de Entorno:**
    Asegúrate de tener un archivo `.env.local` en la raíz de `/frontend` con las siguientes llaves (obtenidas del dashboard de Supabase):
    ```env
    NEXT_PUBLIC_SUPABASE_URL=tu_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
    NEXT_PUBLIC_API_URL=http://localhost:8000
    ```

3.  **Ejecutar el Servidor de Desarrollo:**
    ```bash
    npm run dev
    ```
    Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver el resultado. Automáticamente serás redirigido a la pantalla de `/login`.
