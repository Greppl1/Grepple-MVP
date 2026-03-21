from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    database_path: Path
    anthropic_api_key: str | None
    anthropic_model: str
    anthropic_version: str
    zian_webhook_url: str = ""
    zian_webhook_api_key: str = ""
    app_title: str = "AAO Launchpad Scoring Engine"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    base_dir = Path(__file__).resolve().parent
    default_db = base_dir / "reports.db"
    return Settings(
        database_path=Path(os.getenv("SCORING_ENGINE_DB_PATH", default_db)),
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
        anthropic_model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
        anthropic_version=os.getenv("ANTHROPIC_VERSION", "2023-06-01"),
        zian_webhook_url=os.getenv("ZIAN_WEBHOOK_URL", ""),
        zian_webhook_api_key=os.getenv("ZIAN_WEBHOOK_API_KEY", ""),
    )
