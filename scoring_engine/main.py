from __future__ import annotations

import uuid
from pathlib import Path

from scoring_engine.config import get_settings
from scoring_engine.engine import AnthropicLLMClient, ReportStore, ScoringEngine
from scoring_engine.models.report import (
    BatchDiagnosisRequest,
    BatchDiagnosisResponse,
    DiagnosticReport,
)
from scoring_engine.models.submission import ImprovedToolSubmission, SubmissionResponse
from scoring_engine.models.tool_input import ToolInput
from scoring_engine.score_formulas import compute_scores, scores_to_dict

try:
    from fastapi import FastAPI, HTTPException  # type: ignore
except ImportError:  # pragma: no cover - exercised in local environment
    from scoring_engine.compat.fastapi import FastAPI, HTTPException


def create_app(
    db_path: str | Path | None = None, llm_client: object | None = None
) -> FastAPI:
    settings = get_settings()
    store = ReportStore(db_path or settings.database_path)
    engine = ScoringEngine(
        store=store, llm_client=llm_client or AnthropicLLMClient(settings)
    )
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

    @app.post("/api/v1/tools/submit")
    async def submit_tool(payload: ImprovedToolSubmission) -> SubmissionResponse:
        report = await engine.diagnose(payload.tool)
        return SubmissionResponse(
            submissionId=str(uuid.uuid4()),
            toolName=payload.tool.name,
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
