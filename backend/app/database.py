import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv
# Buscamos y cargamos el archivo .env automáticamente
load_dotenv()

# Intenta leer la variable de entorno, si no pone una por defecto local
DATABASE_URL = os.getenv("DATABASE_URL")

# Crear el motor de conexión de SQLAlchemy
engine = create_engine(DATABASE_URL)

# Si está vacía, te frena de inmediato y te dice por qué
if not DATABASE_URL:
    raise ValueError("ERROR: No se encontró la variable DATABASE_URL. Verifica que el archivo .env esté dentro de la carpeta backend.")

# Crear la sesión para interactuar con las tablas
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Clase base para los modelos
Base = declarative_base()

# Dependencia para inyectar la BD en las rutas de FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()