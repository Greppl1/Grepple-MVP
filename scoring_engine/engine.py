from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from pathlib import Path

import httpx

from scoring_engine.analyzers.callability import evaluate_callability
from scoring_engine.analyzers.discoverability import analyze_discoverability
from scoring_engine.analyzers.rewriter import rewrite_tool
from scoring_engine.analyzers.schema_health import analyze_schema_health
from scoring_engine.config import Settings, get_settings
from scoring_engine.models.report import (
    CallabilityMetrics,
    DescriptionMetrics,
    Diagnosis,
    DiagnosticReport,
    Issue,
    Metrics,
    SchemaMetrics,
)
from scoring_engine.models.tool_input import ToolInput

try:
    import aiosqlite  # type: ignore
except ImportError:  # pragma: no cover - exercised in local environment
    from scoring_engine.compat import aiosqlite


class NullLLMClient:
    async def evaluate_tool(
        self,
        prompt_type: str,
        prompt: str,
        tool: ToolInput,
    ) -> dict[str, object]:
        return {"outcome": "silent", "reasoning": "No LLM client configured"}

    async def rewrite_tool(
        self,
        tool: ToolInput,
        diagnosis: Diagnosis,
    ) -> dict[str, object] | None:
        return None


class AnthropicLLMClient(NullLLMClient):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def evaluate_tool(
        self,
        prompt_type: str,
        prompt: str,
        tool: ToolInput,
    ) -> dict[str, object]:
        if not self._settings.anthropic_api_key:
            return await super().evaluate_tool(prompt_type, prompt, tool)
        payload = {
            "model": self._settings.anthropic_model,
            "max_tokens": 256,
            "tools": [
                {
                    "name": tool.name,
                    "description": tool.description,
                    "input_schema": tool.input_schema,
                }
            ],
            "tool_choice": {"type": "auto"},
            "messages": [{"role": "user", "content": prompt}],
        }
        headers = {
            "x-api-key": self._settings.anthropic_api_key,
            "anthropic-version": self._settings.anthropic_version,
            "content-type": "application/json",
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers)
            response.raise_for_status()
        data = response.json()
        content = data.get("content", [])
        text_blocks = [block.get("text", "") for block in content if block.get("type") == "text"]
        tool_block = next((block for block in content if block.get("type") == "tool_use"), None)
        if tool_block:
            return {"outcome": "invoked", "reasoning": " ".join(text_blocks).strip() or None}
        if text_blocks:
            return {"outcome": "mentioned", "reasoning": " ".join(text_blocks).strip()}
        return {"outcome": "silent", "reasoning": None}

    async def rewrite_tool(
        self,
        tool: ToolInput,
        diagnosis: Diagnosis,
    ) -> dict[str, object] | None:
        if not self._settings.anthropic_api_key:
            return None
        prompt = (
            "Rewrite this MCP tool definition for higher discoverability and callability. "
            "Return JSON with keys description, inputSchema, rationale only.\n"
            f"Tool: {tool.model_dump_json(by_alias=True)}\n"
            f"Diagnosis: {json.dumps(diagnosis.model_dump(by_alias=True))}"
        )
        payload = {
            "model": self._settings.anthropic_model,
            "max_tokens": 600,
            "messages": [{"role": "user", "content": prompt}],
        }
        headers = {
            "x-api-key": self._settings.anthropic_api_key,
            "anthropic-version": self._settings.anthropic_version,
            "content-type": "application/json",
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers)
            response.raise_for_status()
        data = response.json()
        blocks = [block.get("text", "") for block in data.get("content", []) if block.get("type") == "text"]
        if not blocks:
            return None
        return json.loads("".join(blocks))


class ReportStore:
    def __init__(self, database_path: str | Path) -> None:
        self.database_path = Path(database_path)

    async def initialize(self) -> None:
        connection = await aiosqlite.connect(self.database_path)
        try:
            await connection.execute(
                """
                CREATE TABLE IF NOT EXISTS reports (
                    report_id TEXT PRIMARY KEY,
                    tool_name TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    payload TEXT NOT NULL
                )
                """
            )
            info_cursor = await connection.execute("PRAGMA table_info(reports)")
            info_rows = await info_cursor.fetchall()
            columns = {str(row[1]) for row in info_rows}
            if "tool_name" not in columns:
                await connection.execute("ALTER TABLE reports ADD COLUMN tool_name TEXT NOT NULL DEFAULT ''")
            if "created_at" not in columns:
                await connection.execute("ALTER TABLE reports ADD COLUMN created_at TEXT NOT NULL DEFAULT ''")
            if "payload" not in columns:
                await connection.execute("ALTER TABLE reports ADD COLUMN payload TEXT NOT NULL DEFAULT '{}'")
            await connection.commit()
        finally:
            await connection.close()

    async def save_report(self, report: DiagnosticReport) -> None:
        await self.initialize()
        connection = await aiosqlite.connect(self.database_path)
        try:
            columns = await self._get_report_columns(connection)
            payload = {
                "report_id": report.report_id,
                "tool_name": report.tool_name,
                "created_at": report.timestamp,
                "payload": report.model_dump_json(by_alias=True),
                # Preserve compatibility with score-era databases that still require these columns.
                "category": report.original_tool.category,
                "overall_score": 0.0,
            }
            insert_columns = [column for column in payload if column in columns]
            placeholders = ", ".join("?" for _ in insert_columns)
            column_sql = ", ".join(insert_columns)
            await connection.execute(
                f"INSERT OR REPLACE INTO reports({column_sql}) VALUES ({placeholders})",
                tuple(payload[column] for column in insert_columns),
            )
            await connection.commit()
        finally:
            await connection.close()

    async def load_report(self, report_id: str) -> DiagnosticReport | None:
        await self.initialize()
        connection = await aiosqlite.connect(self.database_path)
        try:
            cursor = await connection.execute("SELECT payload FROM reports WHERE report_id = ?", (report_id,))
            row = await cursor.fetchone()
        finally:
            await connection.close()
        if row is None:
            return None
        return DiagnosticReport.model_validate_json(row[0])

    async def _get_report_columns(self, connection: object) -> set[str]:
        cursor = await connection.execute("PRAGMA table_info(reports)")
        rows = await cursor.fetchall()
        return {str(row[1]) for row in rows}


class ScoringEngine:
    def __init__(self, store: ReportStore, llm_client: object | None = None) -> None:
        self._store = store
        self._llm_client = llm_client or AnthropicLLMClient(get_settings())

    async def diagnose(self, tool: ToolInput) -> DiagnosticReport:
        schema_metrics = analyze_schema_health(tool)
        description_metrics = analyze_discoverability(tool)
        callability_metrics = await evaluate_callability(tool, self._llm_client)
        diagnosis = _classify_diagnosis(
            schema_metrics=schema_metrics,
            description_metrics=description_metrics,
            callability_metrics=callability_metrics,
        )
        suggestions = await rewrite_tool(tool, self._llm_client, diagnosis)
        report = DiagnosticReport(
            reportId=str(uuid.uuid4()),
            toolName=tool.name,
            timestamp=datetime.now(UTC).isoformat(),
            metrics=Metrics(
                schema=schema_metrics,
                description=description_metrics,
                callability=callability_metrics,
            ),
            diagnosis=diagnosis,
            suggestions=suggestions,
            originalTool=tool,
        )
        await self._store.save_report(report)
        return report

    async def diagnose_batch(self, tools: list[ToolInput]) -> list[DiagnosticReport]:
        reports: list[DiagnosticReport] = []
        for tool in tools:
            reports.append(await self.diagnose(tool))
        return reports

    async def get_report(self, report_id: str) -> DiagnosticReport | None:
        return await self._store.load_report(report_id)


def _classify_diagnosis(
    schema_metrics: SchemaMetrics,
    description_metrics: DescriptionMetrics,
    callability_metrics: CallabilityMetrics,
) -> Diagnosis:
    schema_issues = _non_low_issues(schema_metrics.issues)
    description_issues = _non_low_issues(description_metrics.issues)
    callability_issues = list(callability_metrics.issues)
    counts = _format_callability_counts(callability_metrics)

    if callability_metrics.skipped:
        if schema_issues and description_issues:
            return Diagnosis(
                failureMode="mixed",
                rootCause="LLM testing was skipped; both schema and description metrics have blocking issues.",
                issues=_merge_issues(schema_issues, description_issues),
            )
        if schema_issues:
            return Diagnosis(
                failureMode="schema_failure",
                rootCause="LLM testing was skipped; schema metrics show blocking input-definition issues.",
                issues=schema_issues,
            )
        if description_issues:
            return Diagnosis(
                failureMode="description_failure",
                rootCause="LLM testing was skipped; description metrics show blocking discoverability issues.",
                issues=description_issues,
            )
        return Diagnosis(
            failureMode="healthy",
            rootCause="LLM testing was skipped, but schema and description metrics show no blocking issues.",
            issues=[],
        )

    if callability_metrics.error_count > 0:
        return Diagnosis(
            failureMode="compatibility_failure",
            rootCause=f"Agent encountered invocation errors during callability testing ({counts}).",
            issues=_merge_issues(callability_issues),
        )

    if callability_metrics.invoke_count == 0:
        if schema_issues and description_issues:
            return Diagnosis(
                failureMode="mixed",
                rootCause=f"Agent never invoked the tool ({counts}), and both schema and description metrics show blocking issues.",
                issues=_merge_issues(callability_issues, schema_issues, description_issues),
            )
        if schema_issues and callability_metrics.mention_count > 0:
            return Diagnosis(
                failureMode="schema_failure",
                rootCause=f"Agent recognized the tool but never invoked it ({counts}), which points to schema friction.",
                issues=_merge_issues(callability_issues, schema_issues),
            )
        return Diagnosis(
            failureMode="description_failure",
            rootCause=f"Agent failed to discover the tool during callability testing ({counts}).",
            issues=_merge_issues(callability_issues, description_issues),
        )

    if callability_metrics.mention_count > callability_metrics.invoke_count:
        if schema_issues:
            return Diagnosis(
                failureMode="schema_failure",
                rootCause=f"Agent mentioned the tool more often than it invoked it ({counts}), which suggests the schema is hard to satisfy.",
                issues=_merge_issues(callability_issues, schema_issues),
            )
        return Diagnosis(
            failureMode="compatibility_failure",
            rootCause=f"Agent repeatedly stopped at tool mention instead of invocation ({counts}).",
            issues=_merge_issues(callability_issues),
        )

    if callability_metrics.silent_count > 0:
        if description_issues:
            return Diagnosis(
                failureMode="description_failure",
                rootCause=f"Some prompts still failed to surface the tool ({counts}), which points to discoverability gaps.",
                issues=_merge_issues(callability_issues, description_issues),
            )
        if schema_issues:
            return Diagnosis(
                failureMode="schema_failure",
                rootCause=f"Some prompts surfaced the tool inconsistently ({counts}), and schema metrics still show blockers.",
                issues=_merge_issues(callability_issues, schema_issues),
            )
        return Diagnosis(
            failureMode="mixed",
            rootCause=f"Callability outcomes were inconsistent across prompts ({counts}) despite no obvious single-source blocker.",
            issues=_merge_issues(callability_issues),
        )

    return Diagnosis(
        failureMode="healthy",
        rootCause=f"Agent invoked the tool reliably during callability testing ({counts}).",
        issues=[],
    )


def _non_low_issues(issues: list[Issue]) -> list[Issue]:
    return [issue for issue in issues if issue.severity != "low"]


def _merge_issues(*issue_groups: list[Issue]) -> list[Issue]:
    merged: list[Issue] = []
    seen: set[tuple[str, str, str]] = set()
    for group in issue_groups:
        for issue in group:
            key = (issue.field, issue.code, issue.detail)
            if key in seen:
                continue
            seen.add(key)
            merged.append(issue)
    return merged


def _format_callability_counts(callability_metrics: CallabilityMetrics) -> str:
    return (
        f"invoked {callability_metrics.invoke_count}/{callability_metrics.tests_run}, "
        f"mentioned {callability_metrics.mention_count}/{callability_metrics.tests_run}, "
        f"silent {callability_metrics.silent_count}/{callability_metrics.tests_run}, "
        f"errors {callability_metrics.error_count}/{callability_metrics.tests_run}"
    )
