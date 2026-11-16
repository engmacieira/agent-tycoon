"""
Configurações centrais da aplicação FastAPI (Agent Tycoon).
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, List

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

ROOT_ENV_PATH = Path(__file__).resolve().parents[3] / ".env"
DEFAULT_SQLITE_URL = "sqlite:///./agent_tycoon.db"


class Settings(BaseSettings):
    """Configurações carregadas via variáveis de ambiente e arquivo .env."""

    PROJECT_NAME: str = "Agent Tycoon API"
    APP_NAME: str = "Agent Tycoon API"
    API_V1_PREFIX: str = "/api/v1"
    DATABASE_URL: str = DEFAULT_SQLITE_URL
    CORS_ORIGINS: Annotated[List[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    LLM_TIMEOUT_SECONDS: float = 60.0

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def _fallback_empty_database_url(cls, value: object) -> str:
        """Garante fallback seguro para SQLite local se DATABASE_URL vier vazia."""
        if value is None or (isinstance(value, str) and not value.strip()):
            return DEFAULT_SQLITE_URL
        return str(value).strip()

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: object) -> List[str]:
        """Aceita tanto lista JSON quanto string separada por vírgulas no .env."""
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []
            if raw.startswith("["):
                parsed = json.loads(raw)
                return [str(item).strip() for item in parsed if str(item).strip()]
            return [origin.strip() for origin in raw.split(",") if origin.strip()]
        if isinstance(value, (list, tuple)):
            return [str(item).strip() for item in value if str(item).strip()]
        return list(value)  # type: ignore[arg-type]

    model_config = SettingsConfigDict(
        env_file=str(ROOT_ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Retorna instância cacheada das configurações."""
    return Settings()


settings = get_settings()
