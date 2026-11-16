"""
Repositório de acesso a dados (SQLAlchemy 2.0) para agentes, memórias, tarefas e FinOps.
"""

from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.office import Agent, AgentMemory, Task, TokenLedger


class OfficeRepository:
    """Encapsula consultas e persistência das entidades do Agent Tycoon."""

    @staticmethod
    def list_active_agents(db: Session) -> List[Agent]:
        """Retorna todos os agentes ativos com suas memórias carregadas."""
        stmt = (
            select(Agent)
            .where(Agent.is_active.is_(True), Agent.deleted_at.is_(None))
            .options(selectinload(Agent.memories))
            .order_by(Agent.created_at.asc())
        )
        return list(db.scalars(stmt).all())

    @staticmethod
    def get_active_agent_by_id(db: Session, agent_id: UUID) -> Optional[Agent]:
        """Busca um agente ativo pelo UUID."""
        stmt = (
            select(Agent)
            .where(
                Agent.id == agent_id,
                Agent.is_active.is_(True),
                Agent.deleted_at.is_(None),
            )
            .options(selectinload(Agent.memories))
        )
        return db.scalars(stmt).first()

    @staticmethod
    def get_active_conflict(
        db: Session, slug: str, env_var_name: str
    ) -> Optional[Agent]:
        """Verifica se já existe agente ativo com o mesmo slug ou env_var_name."""
        stmt = select(Agent).where(
            Agent.deleted_at.is_(None),
            or_(Agent.slug == slug, Agent.env_var_name == env_var_name),
        )
        return db.scalars(stmt).first()

    @staticmethod
    def create_agent(db: Session, agent: Agent) -> Agent:
        """Persiste um novo agente no banco e retorna com ID gerado."""
        db.add(agent)
        db.commit()
        db.refresh(agent)
        return agent

    @staticmethod
    def save_agent(db: Session, agent: Agent) -> Agent:
        """Salva alterações em um agente existente."""
        db.add(agent)
        db.commit()
        db.refresh(agent)
        return agent

    @staticmethod
    def get_top_memories(
        db: Session, agent_id: UUID, limit: int = 2
    ) -> List[AgentMemory]:
        """Retorna as memórias de longo prazo mais recentes do agente."""
        stmt = (
            select(AgentMemory)
            .where(AgentMemory.agent_id == agent_id)
            .order_by(AgentMemory.created_at.desc())
            .limit(limit)
        )
        return list(db.scalars(stmt).all())

    @staticmethod
    def get_task_by_id(db: Session, task_id: UUID) -> Optional[Task]:
        """Busca uma tarefa ativa pelo UUID."""
        stmt = select(Task).where(
            Task.id == task_id,
            Task.deleted_at.is_(None),
        )
        return db.scalars(stmt).first()

    @staticmethod
    def get_agent_today_spend(
        db: Session, agent_id: UUID, since_utc: datetime
    ) -> Decimal:
        """Soma o gasto em USD do agente a partir do início do dia UTC."""
        stmt = select(func.coalesce(func.sum(TokenLedger.cost_usd), 0)).where(
            TokenLedger.agent_id == agent_id,
            TokenLedger.created_at >= since_utc,
        )
        total = db.scalar(stmt)
        return Decimal(str(total or 0))

    @staticmethod
    def create_token_ledger_entry(
        db: Session, entry: TokenLedger
    ) -> TokenLedger:
        """Registra uma entrada imutável no livro-razão FinOps."""
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry

    @staticmethod
    def get_ledger_totals_by_agent(
        db: Session, since_utc: datetime
    ) -> Tuple[Dict[UUID, Tuple[Decimal, int, int]], Dict[UUID, Decimal]]:
        """
        Retorna agregações de gasto e tokens por agente:
        - all_time[agent_id] = (total_cost_usd, total_input_tokens, total_output_tokens)
        - today[agent_id] = today_cost_usd
        """
        all_time_stmt = select(
            TokenLedger.agent_id,
            func.coalesce(func.sum(TokenLedger.cost_usd), 0),
            func.coalesce(func.sum(TokenLedger.input_tokens), 0),
            func.coalesce(func.sum(TokenLedger.output_tokens), 0),
        ).group_by(TokenLedger.agent_id)

        all_time: Dict[UUID, Tuple[Decimal, int, int]] = {}
        for agent_id, cost, in_tok, out_tok in db.execute(all_time_stmt).all():
            all_time[agent_id] = (
                Decimal(str(cost or 0)),
                int(in_tok or 0),
                int(out_tok or 0),
            )

        today_stmt = (
            select(
                TokenLedger.agent_id,
                func.coalesce(func.sum(TokenLedger.cost_usd), 0),
            )
            .where(TokenLedger.created_at >= since_utc)
            .group_by(TokenLedger.agent_id)
        )

        today: Dict[UUID, Decimal] = {}
        for agent_id, cost in db.execute(today_stmt).all():
            today[agent_id] = Decimal(str(cost or 0))

        return all_time, today
