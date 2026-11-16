"""
Configuração de ambiente do Alembic para o Agent Tycoon.

Suporta migrations híbridas entre Cloud SQL PostgreSQL e SQLite local
com render_as_batch=True e compare_type=True.
"""

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# Garante que o diretório backend/ esteja no sys.path para imports de `app.*`
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings
from app.models.office import (  # noqa: F401
    Agent,
    AgentMemory,
    Base,
    PipelineStep,
    Task,
    TokenLedger,
)

# Objeto Config do Alembic, com acesso aos valores do alembic.ini.
config = context.config

# Sobrescreve sqlalchemy.url dinamicamente com a URL resolvida do .env / settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))

# Configura loggers do Python a partir do arquivo .ini.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata dos modelos SQLAlchemy para suporte ao --autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Executa migrations em modo 'offline' (gera SQL sem abrir conexão)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Executa migrations em modo 'online' (conectado ao banco)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            render_as_batch=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
