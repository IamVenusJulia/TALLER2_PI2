import os
import jwt
from jwt import PyJWKClient
import base64
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db

security = HTTPBearer()

# URL de JWKS de Supabase para obtener las claves públicas asimétricas del proyecto (ES256)
SUPABASE_JWKS_URL = "https://jieduufpryoypaasafpg.supabase.co/auth/v1/.well-known/jwks.json"
jwk_client = PyJWKClient(SUPABASE_JWKS_URL)

JWT_SECRET_RAW = os.getenv("SUPABASE_JWT_SECRET")

# El secreto JWT de Supabase viene codificado en base64. Para que PyJWT valide la firma 
# HS256 correctamente, debemos decodificarlo a bytes (devolviendo una clave real de 64 bytes).
try:
    if JWT_SECRET_RAW:
        # Intentamos decodificar si viene con padding de Base64
        JWT_SECRET = base64.b64decode(JWT_SECRET_RAW)
    else:
        JWT_SECRET = None
except Exception:
    JWT_SECRET = JWT_SECRET_RAW

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    
    # Escenario 3: Petición sin credenciales o Token inválido/expirado
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
        
        if alg == "HS256":
            # Si es HS256, usamos la clave secreta simétrica (decodificada de base64)
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
        else:
            # Si es ES256 u otro asimétrico, obtenemos la clave pública del JWKS de Supabase
            signing_key = jwk_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(token, signing_key.key, algorithms=[alg], options={"verify_aud": False})
        
        supabase_uid = payload.get("sub")
        email = payload.get("email")
        
        # Supabase inyecta los metadatos del usuario en 'user_metadata' o los roles en las claims (información) de app_metadata
        app_metadata = payload.get("app_metadata", {})
        user_metadata = payload.get("user_metadata", {})
        
        if not supabase_uid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido: Falta identificador de usuario."
            )
            
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="El token ha expirado.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de autenticación inválido.")

    # Escenario 4: Inyección del contexto del usuario
    try:
        query = text("SELECT id, nombre, apellido, rol FROM usuarios WHERE email = :email AND eliminado = FALSE")
        result = db.execute(query, {"email": email}).fetchone()
        
        if result:
            user_data = {
                "id": supabase_uid,
                "nombre": f"{result.nombre} {result.apellido}",
                "rol": str(result.rol), # Retorna 'admin' o 'cliente'
                "email": email
            }
            return user_data
        elif email:
            # Si el usuario no existe en la tabla usuarios de la base de datos, lo registramos automáticamente
            import random
            import time
            
            full_name = user_metadata.get("full_name", email.split("@")[0] if email else "Usuario Anonimo")
            parts = full_name.split(" ", 1)
            nombre = parts[0]
            apellido = parts[1] if len(parts) > 1 else ""
            
            # Generar un número de teléfono provisional único para cumplir con la restricción VARCHAR(20) NOT NULL UNIQUE
            telefono_prov = f"57{int(time.time())}{random.randint(10, 99)}"[:20]
            
            rol_jwt = app_metadata.get("role", user_metadata.get("rol", "cliente"))
            # Aseguramos que el rol sea uno de los valores permitidos del enum rol_usuario
            rol = "admin" if rol_jwt == "admin" else "cliente"
            
            query_insert = text("""
                INSERT INTO usuarios (id,nombre, apellido, telefono, email, rol, fecha_creacion, updated_at, eliminado)
                VALUES (:id,:nombre, :apellido, :telefono, :email, CAST(:rol AS rol_usuario), NOW(), NOW(), FALSE)
                RETURNING id;
            """)
            
            insert_res = db.execute(query_insert, {
                "id": supabase_uid,
                "nombre": nombre,
                "apellido": apellido,
                "telefono": telefono_prov,
                "email": email,
                "rol": rol
            })
            db.commit()
            
            user_data = {
                "id": supabase_uid,
                "nombre": f"{nombre} {apellido}".strip(),
                "rol": rol,
                "email": email
            }
            return user_data
    except Exception as e:
        db.rollback()
        # En caso de error al insertar, registramos en consola y procedemos con el fallback de emergencia
        print(f"Error en auto-registro de usuario: {str(e)}")

    # Fallback/Emergencia: Extraer rol directo del JWT o asignarle 'cliente' por defecto
    rol_jwt = app_metadata.get("role", user_metadata.get("rol", "cliente"))
    rol = "admin" if rol_jwt == "admin" else "cliente"
    
    user_data = {
        "id": supabase_uid,
        "nombre": user_metadata.get("full_name", email.split("@")[0] if email else "Usuario Anonimo"),
        "rol": rol,
        "email": email
    }
    
    return user_data

# Verificador de Roles (RBAC) - Escenario 2
class RoleChecker:
    def __init__(self, allowed_roles: list):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: dict = Depends(get_current_user)):
        if current_user["rol"] not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso denegado: No tienes los permisos requeridos para esta acción."
            )
        return current_user
