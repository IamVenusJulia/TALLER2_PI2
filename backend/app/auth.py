import os
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db

security = HTTPBearer()

import base64

JWT_SECRET_RAW = os.getenv("SUPABASE_JWT_SECRET")
JWT_ALGORITHM = "HS256"

# El secreto JWT de Supabase viene codificado en base64. Para que PyJWT valide la firma 
# correctamente, debemos decodificarlo a bytes (devolviendo una clave real de 64 bytes).
try:
    if JWT_SECRET_RAW:
        JWT_SECRET = base64.b64decode(JWT_SECRET_RAW)
    else:
        JWT_SECRET = None
except Exception:
    JWT_SECRET = JWT_SECRET_RAW

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    
    # Escenario 3: Petición sin credenciales o Token inválido/expirado
    try:
        # Nota: Ponemos options={"verify_aud": False} temporalmente si estás testeando con tokens JWT estándar creados a mano.
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"verify_aud": False})
        
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
    # Primero intentamos buscarlo en la tabla de usuarios para obtener su rol real y nombre completo, pero si falla, recurrimos a la info del JWT para no bloquear tu demo
    try:
        query = text("SELECT id, nombre, apellido, rol FROM usuarios WHERE email = :email AND eliminado = FALSE")
        result = db.execute(query, {"email": email}).fetchone()
        
        if result:
            user_data = {
                "id": result.id,
                "nombre": f"{result.nombre} {result.apellido}",
                "rol": str(result.rol) # Retorna 'admin' o 'cliente'
            }
            return user_data
    except Exception:
        pass # Si falla o no hay registros, recurrimos de emergencia a la info del JWT para no bloquear tu demo

    # Fallback/Emergencia: Extraer rol directo del JWT o asignarle 'cliente' por defecto
    rol_jwt = app_metadata.get("role", user_metadata.get("rol", "cliente"))
    
    user_data = {
        "id": supabase_uid,
        "nombre": user_metadata.get("full_name", email.split("@")[0] if email else "Usuario Anonimo"),
        "rol": rol_jwt
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