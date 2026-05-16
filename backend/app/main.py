from fastapi import FastAPI

app = FastAPI(
    title="FootCall API",
    description="Backend orquestador para el asistente de voz de reservas deportivas",
    version="0.1.0"
)

@app.get("/")
def read_root():
    return {"status": "ok", "project": "FootCall", "version": "0.1.0"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "database": "pending_connection"}
