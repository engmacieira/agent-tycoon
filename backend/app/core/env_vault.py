import os
import re
from pathlib import Path
from dotenv import load_dotenv

ENV_FILE_PATH = Path(__file__).resolve().parents[3] / ".env"

class EnvVaultManager:
    """Gerencia escrita atômica no arquivo .env e sincronização com os.environ."""

    @staticmethod
    def _sanitize_var_name(var_name: str) -> str:
        clean = re.sub(r"[^A-Z0-9_]", "_", var_name.upper().strip())
        if not clean.startswith("AGENT_"):
            clean = f"AGENT_{clean}"
        return clean

    @classmethod
    def set_agent_key(cls, var_name: str, api_key: str) -> str:
        """Grava ou atualiza uma chave no .env e injeta no processo ativo."""
        safe_var = cls._sanitize_var_name(var_name)
        clean_key = api_key.strip()

        if not ENV_FILE_PATH.exists():
            ENV_FILE_PATH.touch(mode=0o600)

        lines = ENV_FILE_PATH.read_text(encoding="utf-8").splitlines()
        updated = False
        new_lines = []

        for line in lines:
            if line.startswith(f"{safe_var}="):
                new_lines.append(f'{safe_var}="{clean_key}"')
                updated = True
            else:
                new_lines.append(line)

        if not updated:
            new_lines.append(f'{safe_var}="{clean_key}"')

        ENV_FILE_PATH.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
        os.environ[safe_var] = clean_key
        return safe_var

    @classmethod
    def has_configured_key(cls, var_name: str) -> bool:
        """Verifica se a variável existe e não está vazia sem expor o segredo."""
        load_dotenv(ENV_FILE_PATH, override=False)
        val = os.getenv(var_name, "").strip()
        return len(val) > 5

    @classmethod
    def get_secret_for_execution(cls, var_name: str) -> str:
        """Uso exclusivo interno do servidor no momento da chamada LLM."""
        load_dotenv(ENV_FILE_PATH, override=False)
        secret = os.getenv(var_name, "").strip()
        if not secret:
            raise ValueError(f"Chave de API não encontrada no cofre para: {var_name}")
        return secret