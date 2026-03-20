from __future__ import annotations

from pathlib import Path

from scoring_engine.config import get_settings
from scoring_engine.engine import AnthropicLLMClient, ReportStore, ScoringEngine
from scoring_engine.models.report import BatchDiagnosisRequest, BatchDiagnosisResponse, DiagnosticReport
from scoring_engine.models.tool_input import ToolInput

try:
    from fastapi import FastAPI, HTTPException  # type: ignore
except ImportError:  # pragma: no cover - exercised in local environment
    from scoring_engine.compat.fastapi import FastAPI, HTTPException


def create_app(db_path: str | Path | None = None, llm_client: object | None = None) -> FastAPI:
    settings = get_settings()
    store = ReportStore(db_path or settings.database_path)
    engine = ScoringEngine(store=store, llm_client=llm_client or AnthropicLLMClient(settings))
    app = FastAPI(title=settings.app_title)

    @app.post("/api/v1/diagnose")
    async def diagnose(payload: ToolInput) -> DiagnosticReport:
        return await engine.diagnose(payload)

    @app.post("/api/v1/diagnose/batch")
    async def diagnose_batch(payload: BatchDiagnosisRequest) -> BatchDiagnosisResponse:
        reports = await engine.diagnose_batch(payload.tools)
        return BatchDiagnosisResponse(reports=reports)

    @app.get("/api/v1/report/{report_id}")
    async def get_report(report_id: str) -> DiagnosticReport:
        report = await engine.get_report(report_id)
        if report is None:
            raise HTTPException(status_code=404, detail="Report not found")
        return report

    return app


app = create_app()
