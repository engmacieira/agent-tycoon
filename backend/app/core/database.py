"""
Gerenciamento de conexão SQLAlchemy 2.0 (Cloud SQL PostgreSQL / SQLite híbrido).
"""

from typing import Any, Dict, Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.models.office import Base

is_sqlite = settings.DATABASE_URL.startswith("sqlite")
is_postgresql = settings.DATABASE_URL.startswith("postgresql")

engine_kwargs: Dict[str, Any] = {"future": True}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
elif is_postgresql:
    engine_kwargs.update(
        {
            "pool_pre_ping": True,
            "pool_size": 5,
            "max_overflow": 10,
        }
    )
else:
    engine_kwargs["pool_pre_ping"] = True

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)


@event.listens_for(Engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _connection_record) -> None:
    """Habilita integridade referencial (FOREIGN KEY) quando usando SQLite."""
    if is_sqlite:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=Session,
)


def get_db() -> Generator[Session, None, None]:
    """Dependência FastAPI que fornece uma sessão de banco por requisição."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Cria tabelas caso ainda não existam (útil em dev/testes sem Alembic)."""
    Base.metadata.create_all(bind=engine)
