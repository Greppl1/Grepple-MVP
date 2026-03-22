from __future__ import annotations

import html
import json
import os
import time
import uuid
from collections import defaultdict, deque
from math import ceil
from pathlib import Path
from threading import Lock
from typing import Any, Callable, Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field

from scoring_engine.config import Settings, get_settings
from scoring_engine.engine import AnthropicLLMClient, ReportStore, ScoringEngine
from scoring_engine.models.report import (
    BatchDiagnosisRequest,
    BatchDiagnosisResponse,
    Diagnosis,
    DiagnosticReport,
)
from scoring_engine.models.submission import ImprovedToolSubmission, SubmissionResponse
from scoring_engine.models.tool_input import ToolInput
from scoring_engine.score_formulas import compute_scores, scores_to_dict

try:
    from fastapi import FastAPI, HTTPException, Request  # type: ignore
    from fastapi.middleware.cors import CORSMiddleware  # type: ignore
    from fastapi.responses import JSONResponse  # type: ignore
except ImportError:  # pragma: no cover - exercised in local environment
    from scoring_engine.compat.fastapi import (  # type: ignore
        CORSMiddleware,
        FastAPI,
        HTTPException,
        JSONResponse,
        Request,
    )


ALLOWED_ORIGINS = [
    "https://grepple.vercel.app",
    "http://localhost:3000",
]

_API_KEY_PREFIXES = {
    "anthropic": "sk-ant-",
    "openai": "sk-",
    "google": "AI",
}


class LiveModelConfig(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    provider: Literal["anthropic", "openai", "google"]
    api_key: str = Field(alias="apiKey", min_length=1)
    model: str = Field(min_length=1)


class LiveDiagnosisRequest(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    tool_name: str = Field(alias="toolName", min_length=1, max_length=64)
    tool_description: str = Field(alias="toolDescription", min_length=1)
    server_url: str | None = Field(default=None, alias="serverUrl")
    input_schema: dict[str, Any] | None = Field(default=None, alias="inputSchema")
    model_config_payload: LiveModelConfig = Field(alias="modelConfig")


class LiveAnthropicLLMClient:
    def __init__(self, settings: Settings, api_key: str, model: str) -> None:
        self._settings = settings
        self._api_key = api_key
        self._model = model

    async def rewrite_tool(
        self,
        tool: ToolInput,
        diagnosis: Diagnosis,
    ) -> dict[str, object] | None:
        prompt = (
            "Rewrite this MCP tool definition for higher discoverability and schema clarity. "
            "Return JSON with keys description, inputSchema, rationale only.\n"
            f"Tool: {tool.model_dump_json(by_alias=True)}\n"
            f"Diagnosis: {json.dumps(diagnosis.model_dump(by_alias=True))}"
        )
        payload = {
            "model": self._model,
            "max_tokens": 600,
            "messages": [{"role": "user", "content": prompt}],
        }
        headers = {
            "x-api-key": self._api_key,
            "anthropic-version": self._settings.anthropic_version,
            "content-type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
        data = response.json()
        blocks = [
            block.get("text", "")
            for block in data.get("content", [])
            if block.get("type") == "text"
        ]
        if not blocks:
            return None
        return json.loads("".join(blocks))


class InMemoryRateLimiter:
    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str) -> int | None:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= self.window_seconds:
                hits.popleft()
            if len(hits) >= self.max_requests:
                retry_after = max(1, ceil(self.window_seconds - (now - hits[0])))
                return retry_after
            hits.append(now)
        return None


def _app_kwargs(settings: object) -> dict[str, object]:
    del settings
    if os.getenv("ENV") == "production":
        return {"docs_url": None, "redoc_url": None, "openapi_url": None}
    return {}


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    client = getattr(request, "client", None)
    return getattr(client, "host", "unknown")


def _sanitize_tool(tool: ToolInput) -> ToolInput:
    return tool.model_copy(
        update={
            "name": html.escape(tool.name),
            "description": html.escape(tool.description),
        }
    )


def _validate_api_key_format(provider: str, api_key: str) -> bool:
    prefix = _API_KEY_PREFIXES.get(provider)
    return bool(prefix) and api_key.startswith(prefix)


def _default_live_input_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "input": {
                "type": "string",
                "description": "Primary input for the tool",
            }
        },
        "required": ["input"],
    }


def _build_live_tool(payload: LiveDiagnosisRequest) -> ToolInput:
    return ToolInput.model_validate(
        {
            "name": payload.tool_name,
            "description": payload.tool_description,
            "serverUrl": payload.server_url,
            "inputSchema": payload.input_schema or _default_live_input_schema(),
            "category": "uncategorized",
            "runLlmTest": True,
        }
    )


def create_app(
    db_path: str | Path | None = None, llm_client: object | None = None
) -> FastAPI:
    settings = get_settings()
    store = ReportStore(db_path or settings.database_path)
    engine = ScoringEngine(
        store=store, llm_client=llm_client or AnthropicLLMClient(settings)
    )
    app = FastAPI(title=settings.app_title, **_app_kwargs(settings))
    global_rate_limiter = InMemoryRateLimiter(max_requests=30, window_seconds=60)
    diagnose_rate_limiter = InMemoryRateLimiter(max_requests=5, window_seconds=60)
    diagnose_live_rate_limiter = InMemoryRateLimiter(
        max_requests=10, window_seconds=3600
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def security_and_rate_limit(
        request: Request,
        call_next: Callable[[Request], object],
    ) -> object:
        ip_address = _client_ip(request)
        retry_after = global_rate_limiter.check(ip_address)
        if retry_after is None and request.url.path == "/api/v1/diagnose":
            retry_after = diagnose_rate_limiter.check(ip_address)
        if retry_after is None and request.url.path == "/api/v1/diagnose-live":
            retry_after = diagnose_live_rate_limiter.check(ip_address)
        if retry_after is not None:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too Many Requests"},
                headers={
                    "Retry-After": str(retry_after),
                    "X-Content-Type-Options": "nosniff",
                    "X-Frame-Options": "DENY",
                    "Strict-Transport-Security": "max-age=31536000",
                },
            )

        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    @app.post("/api/v1/diagnose")
    async def diagnose(payload: ToolInput) -> DiagnosticReport:
        return await engine.diagnose(_sanitize_tool(payload))

    @app.post("/api/v1/diagnose-live")
    async def diagnose_live(payload: LiveDiagnosisRequest) -> dict[str, object]:
        provider = payload.model_config_payload.provider
        api_key = payload.model_config_payload.api_key
        if not _validate_api_key_format(provider, api_key):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid API key format for provider {provider}",
            )
        if provider != "anthropic":
            raise HTTPException(
                status_code=400,
                detail="Only anthropic is supported for live rewrite suggestions",
            )

        live_engine = ScoringEngine(
            store=store,
            llm_client=LiveAnthropicLLMClient(
                settings=settings,
                api_key=api_key,
                model=payload.model_config_payload.model,
            ),
        )
        report = await live_engine.diagnose(_sanitize_tool(_build_live_tool(payload)))
        scores = compute_scores(report)
        return {
            "reportId": report.report_id,
            "scores": {
                "schemaHealthScore": scores.schema_health.total,
                "discoverabilityScore": scores.discoverability.total,
                "overallScore": scores.overall,
            },
            "diagnosis": report.diagnosis.model_dump(by_alias=True),
            "rewriteSuggestion": report.suggestions.model_dump(by_alias=True),
        }

    @app.post("/api/v1/diagnose/batch")
    async def diagnose_batch(payload: BatchDiagnosisRequest) -> BatchDiagnosisResponse:
        reports = await engine.diagnose_batch(
            [_sanitize_tool(tool) for tool in payload.tools]
        )
        return BatchDiagnosisResponse(reports=reports)

    @app.get("/api/v1/report/{report_id}")
    async def get_report(report_id: str) -> DiagnosticReport:
        report = await engine.get_report(report_id)
        if report is None:
            raise HTTPException(status_code=404, detail="Report not found")
        return report

    @app.post("/api/v1/tools/submit")
    async def submit_tool(payload: ImprovedToolSubmission) -> SubmissionResponse:
        sanitized_tool = _sanitize_tool(payload.tool)
        report = await engine.diagnose(sanitized_tool)
        return SubmissionResponse(
            submissionId=str(uuid.uuid4()),
            toolName=sanitized_tool.name,
            original_report_id=payload.original_report_id,
            reDiagnosis=report,
        )

    @app.post("/api/v1/tools/list")
    async def list_tools() -> dict[str, list[object]]:
        return {"tools": []}

    @app.get("/api/v1/report/{report_id}/scores")
    async def get_report_scores(report_id: str) -> dict[str, object]:
        """Return human-readable 0-100 scores computed from a saved report."""
        report = await engine.get_report(report_id)
        if report is None:
            raise HTTPException(status_code=404, detail="Report not found")
        return scores_to_dict(compute_scores(report))

    @app.get("/api/v1/tools/{tool_name}/latest")
    async def get_latest_tool(tool_name: str) -> dict[str, str]:
        del tool_name
        raise HTTPException(status_code=404, detail="Tool registry not implemented yet")

    return app


app = create_app()
