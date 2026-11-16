"""
Schemas Pydantic v2 para os endpoints da API do Agent Tycoon.
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AgentMemoryOut(BaseModel):
    """Representação pública de uma memória de longo prazo do agente."""

    id: UUID
    fact_summary: str
    tags: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentOut(BaseModel):
    """Dados do agente expostos ao frontend (sem jamais vazar segredos do .env)."""

    id: UUID
    slug: str
    name: str
    role: str
    department: str
    provider: str
    model_id: str
    env_var_name: str
    is_configured: bool
    dna_prompt: str
    daily_budget_usd: Decimal
    status: str
    desk_slot: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    memories: List[AgentMemoryOut] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class AgentHireRequest(BaseModel):
    """Payload de contratação aprovada pelo CEO."""

    slug: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(..., min_length=1, max_length=120)
    department: str = Field(..., min_length=1, max_length=50)
    provider: str = Field(default="google", min_length=1, max_length=40)
    model_id: str = Field(default="gemini-3-flash-preview", min_length=1, max_length=100)
    env_var_name: str = Field(..., min_length=1, max_length=100)
    api_key: Optional[str] = Field(
        default=None,
        description="Chave secreta gravada exclusivamente no .env via EnvVaultManager.",
    )
    dna_prompt: str = Field(..., min_length=1)
    daily_budget_usd: Decimal = Field(default=Decimal("1.0000"), ge=0)
    desk_slot: Optional[str] = Field(default=None, max_length=50)
    status: str = Field(default="idle", max_length=30)


class AgentHireResponse(BaseModel):
    """Resposta da contratação com agente pronto para spawnar na Recepção."""

    agent: AgentOut
    spawn_location: str = "recepcao"
    message: str


class AgentVaultUpdateRequest(BaseModel):
    """Atualização de modelo ou rotação de API Key no cofre .env."""

    model_id: Optional[str] = Field(default=None, min_length=1, max_length=100)
    provider: Optional[str] = Field(default=None, min_length=1, max_length=40)
    api_key: Optional[str] = Field(
        default=None,
        description="Nova API Key para rotacionar no .env (não retornada na resposta).",
    )
    daily_budget_usd: Optional[Decimal] = Field(default=None, ge=0)


class AgentVaultUpdateResponse(BaseModel):
    """Resultado da atualização de modelo/cofre do agente."""

    agent: AgentOut
    rotated_key: bool
    updated_model: bool


class LlmExecuteRequest(BaseModel):
    """Requisição segura de execução LLM via proxy do backend."""

    agent_id: UUID
    task_id: Optional[UUID] = None
    prompt_payload: str = Field(..., min_length=1)
    operation_type: str = Field(default="task_execution", max_length=40)
    response_mime_type: Optional[str] = Field(default=None, max_length=100)
    max_output_tokens: Optional[int] = Field(default=None, ge=1, le=65536)
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)


class LlmExecuteResponse(BaseModel):
    """Resposta da execução LLM com texto gerado e auditoria FinOps."""

    agent_id: UUID
    task_id: Optional[UUID] = None
    model_id: str
    text: str
    input_tokens: int
    output_tokens: int
    cost_usd: Decimal
    memories_used: List[str] = Field(default_factory=list)
    ledger_entry_id: UUID


class AgentSpendSummary(BaseModel):
    """Gasto consolidado por funcionário."""

    agent_id: UUID
    slug: str
    name: str
    department: str
    model_id: str
    daily_budget_usd: Decimal
    today_spend_usd: Decimal
    total_spend_usd: Decimal
    total_input_tokens: int
    total_output_tokens: int
    budget_utilization_pct: float


class IslandSpendSummary(BaseModel):
    """Gasto consolidado por ilha/departamento."""

    department: str
    agent_count: int
    today_spend_usd: Decimal
    total_spend_usd: Decimal
    total_daily_budget_usd: Decimal
    total_input_tokens: int
    total_output_tokens: int


class BudgetAlert(BaseModel):
    """Alerta de orçamento para o Vega (FinOps)."""

    agent_id: UUID
    slug: str
    name: str
    department: str
    severity: Literal["warning", "critical"]
    today_spend_usd: Decimal
    daily_budget_usd: Decimal
    utilization_pct: float
    message: str


class FinopsSummaryOut(BaseModel):
    """Resumo FinOps consolidado para o Vega e HUD."""

    generated_at: datetime
    total_today_spend_usd: Decimal
    total_all_time_spend_usd: Decimal
    total_daily_budget_usd: Decimal
    by_agent: List[AgentSpendSummary]
    by_island: List[IslandSpendSummary]
    alerts: List[BudgetAlert]


class OfficeStateOut(BaseModel):
    """Estado inicial completo do escritório carregado pelo frontend."""

    agents: List[AgentOut]
    finops: FinopsSummaryOut
