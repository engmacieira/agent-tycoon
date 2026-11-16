"""
Rotas da API FastAPI para o Agent Tycoon (/api/v1).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.office import (
    AgentHireRequest,
    AgentHireResponse,
    AgentVaultUpdateRequest,
    AgentVaultUpdateResponse,
    FinopsSummaryOut,
    LlmExecuteRequest,
    LlmExecuteResponse,
    OfficeStateOut,
)
from app.services.orchestrator_service import OrchestratorService, ServiceError

router = APIRouter(prefix="/api/v1", tags=["office"])


def _handle_service_error(exc: ServiceError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.get(
    "/office/state",
    response_model=OfficeStateOut,
    summary="Carrega estado inicial do escritório",
)
def get_office_state(db: Session = Depends(get_db)) -> OfficeStateOut:
    """
    Carrega todos os agentes ativos, status de configuração no cofre .env
    (`is_configured`: true/false, sem segredos), memórias de longo prazo e resumo FinOps.
    """
    return OrchestratorService.get_office_state(db)


@router.post(
    "/agents/hire",
    response_model=AgentHireResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Contrata um novo agente aprovado pelo CEO",
)
def hire_agent(
    payload: AgentHireRequest,
    db: Session = Depends(get_db),
) -> AgentHireResponse:
    """
    Grava a API Key no .env via EnvVaultManager (quando informada),
    persiste o funcionário no banco e retorna o agente pronto para spawnar na Recepção.
    """
    try:
        return OrchestratorService.hire_agent(db, payload)
    except ServiceError as exc:
        raise _handle_service_error(exc)


@router.patch(
    "/agents/{agent_id}/vault",
    response_model=AgentVaultUpdateResponse,
    summary="Atualiza modelo ou rotaciona API Key do agente",
)
def update_agent_vault(
    agent_id: UUID,
    payload: AgentVaultUpdateRequest,
    db: Session = Depends(get_db),
) -> AgentVaultUpdateResponse:
    """Atualiza o `model_id` / orçamento no banco e/ou rotaciona a API Key no .env."""
    try:
        return OrchestratorService.update_agent_vault(db, agent_id, payload)
    except ServiceError as exc:
        raise _handle_service_error(exc)


@router.post(
    "/llm/execute",
    response_model=LlmExecuteResponse,
    summary="Proxy seguro de execução LLM com contabilização FinOps",
)
def execute_llm(
    payload: LlmExecuteRequest,
    db: Session = Depends(get_db),
) -> LlmExecuteResponse:
    """
    Busca `dna_prompt` + top 2 memórias no banco, lê a chave secreta no EnvVaultManager,
    chama a API do provedor de IA, grava o gasto exato em `token_ledger` e devolve o texto gerado.
    """
    try:
        return OrchestratorService.execute_llm(db, payload)
    except ServiceError as exc:
        raise _handle_service_error(exc)


@router.get(
    "/finops/summary",
    response_model=FinopsSummaryOut,
    summary="Resumo FinOps consolidado para o Vega",
)
def get_finops_summary(db: Session = Depends(get_db)) -> FinopsSummaryOut:
    """Entrega o gasto consolidado por funcionário, por ilha e alertas de orçamento."""
    return OrchestratorService.get_finops_summary(db)
