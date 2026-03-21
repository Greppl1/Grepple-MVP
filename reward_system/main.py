from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Callable

import httpx
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
    from fastapi import FastAPI, HTTPException, Request  # type: ignore
    from fastapi.middleware.cors import CORSMiddleware  # type: ignore
except ImportError:  # pragma: no cover - exercised in local environment
    from scoring_engine.compat.fastapi import (  # type: ignore
        CORSMiddleware,
        FastAPI,
        HTTPException,
        Request,
    )


ALLOWED_ORIGINS = [
    "https://grepple.vercel.app",
    "http://localhost:3000",
]

logger = logging.getLogger(__name__)


def _app_kwargs() -> dict[str, object]:
    if os.getenv("ENV") == "production":
        return {"docs_url": None, "redoc_url": None, "openapi_url": None}
    return {}


async def _post_zian_webhook(event: TestTaskEvent, webhook_url: str) -> None:
    payload = {
        "event": "test_task_completed",
        "data": {
            "task_id": event.data.task_id,
            "agent_wallet": event.data.agent_wallet,
            "tool_id": event.data.tool_id,
            "result": event.data.result,
            "scores": {
                "call_success": event.data.scores.call_success,
                "structured_report": event.data.scores.structured_report,
            },
            "timestamp": event.data.timestamp,
        },
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(webhook_url, json=payload)
        response.raise_for_status()


def create_app(db_path: str | Path | None = None) -> FastAPI:
    del db_path
    settings = get_settings()
    app = FastAPI(title=f"{settings.app_title} Reward System", **_app_kwargs())
    webhook_api_key = os.getenv("WEBHOOK_API_KEY", "")
    zian_webhook_url = os.getenv("ZIAN_WEBHOOK_URL", "")
    processed_rewards: dict[str, RewardResult] = {}

    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if not webhook_api_key:
        logger.warning(
            "WEBHOOK_API_KEY is not set; allowing /api/rewards/mint without auth"
        )

    @app.middleware("http")
    async def security_headers(
        request: Request,
        call_next: Callable[[Request], object],
    ) -> object:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    @app.post("/api/rewards/mint")
    async def mint_reward(payload: dict[str, object], request: Request) -> RewardResult:
        if webhook_api_key:
            authorization = request.headers.get("authorization", "")
            if authorization != f"Bearer {webhook_api_key}":
                raise HTTPException(status_code=401, detail="Unauthorized")
        try:
            event = TestTaskEvent.model_validate(payload)
        except ValidationError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Malformed reward event: {exc.errors()[0]['msg']}",
            ) from exc
        if event.data.task_id in processed_rewards:
            return processed_rewards[event.data.task_id]
        try:
            reward = process_reward_event(event)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        processed_rewards[event.data.task_id] = reward
        if zian_webhook_url:
            try:
                await _post_zian_webhook(event, zian_webhook_url)
            except httpx.HTTPError as exc:
                logger.error("Zian webhook failed for task %s: %s", event.data.task_id, exc)
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
