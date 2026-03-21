from __future__ import annotations

from pathlib import Path

from pydantic import ValidationError

from reward_system.external_eval import (
    ExternalEvaluationRequest,
    ExternalEvaluationResponse,
    build_reward_from_external_eval,
)
from reward_system.models.reward import RewardResult, TestTaskEvent
from reward_system.rewards import process_reward_event, send_webhook
from scoring_engine.config import get_settings

try:
    from fastapi import FastAPI, HTTPException  # type: ignore
except ImportError:  # pragma: no cover - exercised in local environment
    from scoring_engine.compat.fastapi import FastAPI, HTTPException


def create_app(db_path: str | Path | None = None) -> FastAPI:
    del db_path
    settings = get_settings()
    app = FastAPI(title=f"{settings.app_title} Reward System")

    @app.post("/api/rewards/mint")
    async def mint_reward(payload: dict[str, object]) -> RewardResult:
        try:
            event = TestTaskEvent.model_validate(payload)
        except ValidationError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Malformed reward event: {exc.errors()[0]['msg']}",
            ) from exc
        try:
            reward = process_reward_event(event)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if settings.zian_webhook_url:
            send_webhook(
                reward, settings.zian_webhook_url, settings.zian_webhook_api_key
            )
        return reward

    @app.post("/api/v1/external-eval")
    async def external_eval(
        payload: ExternalEvaluationRequest,
    ) -> ExternalEvaluationResponse:
        try:
            reward = build_reward_from_external_eval(payload)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if settings.zian_webhook_url:
            send_webhook(
                reward, settings.zian_webhook_url, settings.zian_webhook_api_key
            )
        return ExternalEvaluationResponse(report=payload.report, reward=reward)

    return app


app = create_app()
