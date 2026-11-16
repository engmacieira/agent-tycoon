"""
Ponto de entrada da aplicação FastAPI (Agent Tycoon).
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import init_db
from app.routers.office_router import router as office_router

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Inicializa estrutura do banco em desenvolvimento caso necessário."""
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(office_router)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    """Verificação simples de disponibilidade da API."""
    return {"status": "ok"}
