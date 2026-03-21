from __future__ import annotations

import asyncio

from scoring_engine.main import create_app
from scoring_engine.tests.test_engine import StubLLMClient, build_tool


def test_submit_improved_tool(tmp_path: object) -> None:
    app = create_app(db_path=tmp_path / "reports.db", llm_client=StubLLMClient())
    original_response = asyncio.run(
        app.request("POST", "/api/v1/diagnose", json=build_tool().model_dump(by_alias=True))
    )
    assert original_response.status_code == 200
    original_report = original_response.json()

    improved_tool = build_tool(
        description="Use swap_tokens to swap tokens with explicit amounts, chains, and examples for the builder flow."
    )
    response = asyncio.run(
        app.request(
            "POST",
            "/api/v1/tools/submit",
            json={
                "tool": improved_tool.model_dump(by_alias=True),
                "originalReportId": original_report["reportId"],
                "changesApplied": [
                    "Clarified the description",
                    "Kept the MCP schema aligned with the original tool",
                ],
            },
        )
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["toolName"] == improved_tool.name
    assert payload["original_report_id"] == original_report["reportId"]
    assert payload["reDiagnosis"]["originalTool"]["description"] == improved_tool.description
    assert payload["reDiagnosis"]["toolName"] == improved_tool.name


def test_submit_returns_new_report_id(tmp_path: object) -> None:
    app = create_app(db_path=tmp_path / "reports.db", llm_client=StubLLMClient())
    original_response = asyncio.run(
        app.request("POST", "/api/v1/diagnose", json=build_tool().model_dump(by_alias=True))
    )
    original_report_id = original_response.json()["reportId"]

    response = asyncio.run(
        app.request(
            "POST",
            "/api/v1/tools/submit",
            json={
                "tool": build_tool().model_dump(by_alias=True),
                "originalReportId": original_report_id,
                "changesApplied": ["Submitted an improved tool definition"],
            },
        )
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["submissionId"] != original_report_id
    assert payload["reDiagnosis"]["reportId"] != original_report_id


def test_submit_escapes_html_fields_before_rediagnosis(tmp_path: object) -> None:
    app = create_app(db_path=tmp_path / "reports.db", llm_client=StubLLMClient())
    original_response = asyncio.run(
        app.request("POST", "/api/v1/diagnose", json=build_tool().model_dump(by_alias=True))
    )
    original_report_id = original_response.json()["reportId"]

    response = asyncio.run(
        app.request(
            "POST",
            "/api/v1/tools/submit",
            json={
                "tool": build_tool(
                    name="<svg/onload=alert(1)>",
                    description="<script>bad()</script>",
                ).model_dump(by_alias=True),
                "originalReportId": original_report_id,
                "changesApplied": ["Sanitize unsafe fields"],
            },
        )
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["toolName"] == "&lt;svg/onload=alert(1)&gt;"
    assert payload["reDiagnosis"]["originalTool"]["description"] == "&lt;script&gt;bad()&lt;/script&gt;"


def test_tools_list_returns_empty(tmp_path: object) -> None:
    app = create_app(db_path=tmp_path / "reports.db", llm_client=StubLLMClient())
    response = asyncio.run(app.request("POST", "/api/v1/tools/list"))
    assert response.status_code == 200
    assert response.json() == {"tools": []}


def test_tools_latest_returns_404(tmp_path: object) -> None:
    app = create_app(db_path=tmp_path / "reports.db", llm_client=StubLLMClient())
    response = asyncio.run(app.request("GET", "/api/v1/tools/swap_tokens/latest"))
    assert response.status_code == 404
    assert response.json()["detail"] == "Tool registry not implemented yet"
