"""
Modelos relacionais do Agent Tycoon (SQLAlchemy 2.0).

Define as entidades de agentes, memórias de longo prazo, tarefas,
etapas do pipeline multi-setor e o livro-razão FinOps (token_ledger),
mantendo compatibilidade híbrida entre PostgreSQL e SQLite.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    """Retorna timestamp atual em UTC."""
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    """Classe base declarativa para todos os modelos SQLAlchemy."""
    pass


class TimestampSoftDeleteMixin:
    """Mixin padrão para auditoria temporal e exclusão lógica (Soft Delete)."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        server_default=func.now(),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        default=None,
        nullable=True,
    )


class Agent(Base, TimestampSoftDeleteMixin):
    """
    Representa um funcionário/agente de IA contratado no escritório virtual.

    Armazena metadados operacionais, configuração cognitiva (modelo e DNA prompt)
    e o nome da variável de ambiente vinculada no cofre .env (nunca o segredo em si).
    """

    __tablename__ = "agents"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    slug: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment="Identificador curto no mapa (ex: 'atlas', 'vega', 'kael')",
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(120), nullable=False)
    department: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Diretoria | Coordenacao | Backend | Frontend | Administrativo | Marketing | QA",
    )
    provider: Mapped[str] = mapped_column(
        String(40),
        default="google",
        nullable=False,
        comment="Provedor da API: google | anthropic | openai",
    )
    model_id: Mapped[str] = mapped_column(
        String(100),
        default="gemini-3-flash-preview",
        nullable=False,
    )
    env_var_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Nome da variável no .env (ex: AGENT_TEAM_LEAD_KEY)",
    )
    dna_prompt: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="System prompt enxuto definindo personalidade e diretrizes",
    )
    daily_budget_usd: Mapped[Decimal] = mapped_column(
        Numeric(10, 4),
        default=Decimal("1.0000"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="idle",
        nullable=False,
        comment="Estado atual: idle | working | meeting | qa_review | paused",
    )
    desk_slot: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Identificador da baia alocada no layout 8-bits",
    )

    # Relacionamentos
    memories: Mapped[List["AgentMemory"]] = relationship(
        "AgentMemory",
        back_populates="agent",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    pipeline_steps: Mapped[List["PipelineStep"]] = relationship(
        "PipelineStep",
        back_populates="agent",
    )
    token_entries: Mapped[List["TokenLedger"]] = relationship(
        "TokenLedger",
        back_populates="agent",
    )

    __table_args__ = (
        CheckConstraint("daily_budget_usd >= 0", name="ck_agents_budget_non_negative"),
        # Índice único parcial respeitando Soft Delete (compatível com PostgreSQL e SQLite 3.8+)
        Index(
            "uq_agents_env_var_active",
            "env_var_name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index(
            "uq_agents_slug_active",
            "slug",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index("ix_agents_department_active", "department", "is_active"),
    )


class AgentMemory(Base):
    """
    Memória de Longo Prazo enxuta por agente.

    Armazena resumos objetivos de 1 linha extraídos após entregas concluídas,
    permitindo injeção seletiva de contexto sem inflar o consumo de tokens.
    """

    __tablename__ = "agent_memories"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    agent_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
    )
    fact_summary: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Resumo conciso do aprendizado ou preferência identificada",
    )
    tags: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
        comment="Palavras-chave separadas por vírgula para filtragem rápida",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        server_default=func.now(),
        nullable=False,
    )

    # Relacionamento
    agent: Mapped["Agent"] = relationship("Agent", back_populates="memories")

    __table_args__ = (
        Index("ix_agent_memories_agent_recent", "agent_id", "created_at"),
    )


class Task(Base, TimestampSoftDeleteMixin):
    """
    Demanda (Briefing) enviada pelo CEO na Sala da Diretoria.

    Agrupa o contrato alinhado na War Room, as etapas executadas pelas ilhas,
    o parecer final do Laboratório de QA e o entregável consolidado.
    """

    __tablename__ = "tasks"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    briefing: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(
        String(20),
        default="MEDIA",
        nullable=False,
        comment="BAIXA | MEDIA | ALTA | CRITICA",
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="triaging",
        nullable=False,
        comment="triaging | war_room | in_progress | qa_review | rework | completed | failed",
    )
    war_room_contract: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Contrato técnico compartilhado gerado na Sala de Reunião",
    )
    final_deliverable: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Pacote final consolidado em Markdown entregue à Diretoria",
    )
    qa_verdict: Mapped[Optional[str]] = mapped_column(
        String(40),
        nullable=True,
        comment="APROVADO | APROVADO COM RESSALVAS | REPROVADO",
    )
    qa_report: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Parecer técnico mais recente emitido pelo Laboratório de QA",
    )

    # Relacionamentos
    steps: Mapped[List["PipelineStep"]] = relationship(
        "PipelineStep",
        back_populates="task",
        order_by="PipelineStep.step_order",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    token_entries: Mapped[List["TokenLedger"]] = relationship(
        "TokenLedger",
        back_populates="task",
    )

    __table_args__ = (
        Index("ix_tasks_status_created", "status", "created_at"),
    )


class PipelineStep(Base, TimestampSoftDeleteMixin):
    """
    Etapa individual de execução dentro de uma demanda multi-agente (DAG).

    Controla a ordem entre ilhas, passagem de bastão (handoff) e o contador
    de ciclos de retrabalho solicitados pelo Laboratório de QA.
    """

    __tablename__ = "pipeline_steps"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    task_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
    )
    agent_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("agents.id", ondelete="SET NULL"),
        nullable=True,
    )
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    department: Mapped[str] = mapped_column(String(50), nullable=False)
    depends_on_step_order: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Ordem do passo anterior cujo output alimenta esta etapa",
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="queued",
        nullable=False,
        comment="queued | running | in_qa | rework | completed | failed",
    )
    output_content: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Artefato técnico gerado pelo agente nesta etapa",
    )
    qa_feedback: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Apontamento específico do QA caso esta etapa precise de correção",
    )
    rework_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Número de ciclos de retrabalho executados (máx: 1)",
    )

    # Relacionamentos
    task: Mapped["Task"] = relationship("Task", back_populates="steps")
    agent: Mapped[Optional["Agent"]] = relationship("Agent", back_populates="pipeline_steps")

    __table_args__ = (
        CheckConstraint("step_order >= 1", name="ck_pipeline_steps_order_positive"),
        CheckConstraint("rework_count >= 0", name="ck_pipeline_steps_rework_non_negative"),
        Index("ix_pipeline_steps_task_order", "task_id", "step_order"),
        Index("ix_pipeline_steps_agent_status", "agent_id", "status"),
    )


class TokenLedger(Base):
    """
    Livro-razão imutável de consumo de tokens e custos (FinOps / Vega).

    Registra cada chamada real à API de IA com tokens de entrada, saída e custo
    calculado em USD para auditoria e bloqueio preventivo de orçamento.
    """

    __tablename__ = "token_ledger"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    agent_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("agents.id", ondelete="RESTRICT"),
        nullable=False,
    )
    task_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    model_id: Mapped[str] = mapped_column(String(100), nullable=False)
    operation_type: Mapped[str] = mapped_column(
        String(40),
        default="task_execution",
        nullable=False,
        comment="triaging | war_room | task_execution | rework | qa_review | finops_audit",
    )
    input_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cost_usd: Mapped[Decimal] = mapped_column(
        Numeric(12, 6),
        default=Decimal("0.000000"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        server_default=func.now(),
        nullable=False,
    )

    # Relacionamentos
    agent: Mapped["Agent"] = relationship("Agent", back_populates="token_entries")
    task: Mapped[Optional["Task"]] = relationship("Task", back_populates="token_entries")

    __table_args__ = (
        CheckConstraint("input_tokens >= 0", name="ck_token_ledger_input_non_negative"),
        CheckConstraint("output_tokens >= 0", name="ck_token_ledger_output_non_negative"),
        CheckConstraint("cost_usd >= 0", name="ck_token_ledger_cost_non_negative"),
        Index("ix_token_ledger_agent_date", "agent_id", "created_at"),
        Index("ix_token_ledger_task", "task_id"),
    )