from __future__ import annotations

import asyncio
import json
from unittest.mock import patch

import httpx

from scoring_engine.main import create_app


class _AnthropicResponse:
    def __init__(self, payload: dict[str, object], status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, object]:
        return self._payload


def build_live_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "toolName": "swap_tokens",
        "toolDescription": (
            "Swap an exact amount of tokenIn for tokenOut when the user asks to trade "
            "assets onchain. Example: swap 1 ETH for USDC."
        ),
        "serverUrl": "https://example.com/mcp",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tokenIn": {"type": "string", "description": "Input token address"},
                "tokenOut": {"type": "string", "description": "Output token address"},
            },
            "required": ["tokenIn", "tokenOut"],
        },
        "modelConfig": {
            "provider": "anthropic",
            "apiKey": "sk-ant-test-live-key",
            "model": "claude-3-5-sonnet-latest",
        },
    }
    payload.update(overrides)
    return payload


def test_diagnose_live_returns_scores_diagnosis_and_rewrite(tmp_path: object) -> None:
    app = create_app(db_path=tmp_path / "reports.db")
    anthropic_payload = {
        "content": [
            {
                "type": "text",
                "text": json.dumps(
                    {
                        "description": "Use swap_tokens to exchange one token for another with explicit addresses.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "tokenIn": {
                                    "type": "string",
                                    "description": "Input token address",
                                },
                                "tokenOut": {
                                    "type": "string",
                                    "description": "Output token address",
                                },
                            },
                            "required": ["tokenIn", "tokenOut"],
                        },
                        "rationale": "Clarifies when to call the tool and what inputs matter.",
                    }
                ),
            }
        ]
    }

    with patch(
        "scoring_engine.main.httpx.AsyncClient.post",
        return_value=_AnthropicResponse(anthropic_payload),
    ) as mock_post:
        response = asyncio.run(
            app.request("POST", "/api/v1/diagnose-live", json=build_live_payload())
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["reportId"]
    assert payload["scores"]["schemaHealthScore"] >= 0
    assert payload["scores"]["discoverabilityScore"] >= 0
    assert payload["scores"]["overallScore"] >= 0
    assert payload["diagnosis"]["failureMode"] in {
        "healthy",
        "schema_failure",
        "description_failure",
        "mixed",
    }
    assert payload["rewriteSuggestion"]["description"].startswith("Use swap_tokens")
    assert payload["rewriteSuggestion"]["rationale"]
    assert mock_post.call_count == 1


def test_diagnose_live_builds_default_schema_and_uses_30s_timeout(tmp_path: object) -> None:
    app = create_app(db_path=tmp_path / "reports.db")
    anthropic_payload = {
        "content": [
            {
                "type": "text",
                "text": json.dumps(
                    {
                        "description": "Use summarize_text to summarize plain text input.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "input": {
                                    "type": "string",
                                    "description": "Primary input for the tool",
                                }
                            },
                            "required": ["input"],
                        },
                        "rationale": "Adds a direct action-oriented description.",
                    }
                ),
            }
        ]
    }

    with patch(
        "scoring_engine.main.httpx.AsyncClient"
    ) as mock_client_cls:
        client_instance = mock_client_cls.return_value
        client_instance.__aenter__.return_value = client_instance
        client_instance.__aexit__.return_value = None
        client_instance.post.return_value = _AnthropicResponse(anthropic_payload)

        response = asyncio.run(
            app.request(
                "POST",
                "/api/v1/diagnose-live",
                json=build_live_payload(
                    toolName="summarize_text",
                    toolDescription="Summarize text when a user asks for a shorter version.",
                    inputSchema=None,
                ),
            )
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["rewriteSuggestion"]["inputSchema"]["properties"]["input"]["description"] == (
        "Primary input for the tool"
    )
    mock_client_cls.assert_called_once_with(timeout=30.0)


def test_diagnose_live_rejects_unsupported_provider(tmp_path: object) -> None:
    app = create_app(db_path=tmp_path / "reports.db")
    response = asyncio.run(
        app.request(
            "POST",
            "/api/v1/diagnose-live",
            json=build_live_payload(
                modelConfig={
                    "provider": "openai",
                    "apiKey": "sk-test-key",
                    "model": "gpt-4.1-mini",
                }
            ),
        )
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only anthropic is supported for live rewrite suggestions"


def test_diagnose_live_rejects_invalid_api_key_format(tmp_path: object) -> None:
    app = create_app(db_path=tmp_path / "reports.db")
    response = asyncio.run(
        app.request(
            "POST",
            "/api/v1/diagnose-live",
            json=build_live_payload(
                modelConfig={
                    "provider": "anthropic",
                    "apiKey": "invalid-key",
                    "model": "claude-3-5-sonnet-latest",
                }
            ),
        )
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid API key format for provider anthropic"


def test_diagnose_live_rate_limits_after_ten_requests_per_hour(tmp_path: object) -> None:
    app = create_app(db_path=tmp_path / "reports.db")
    anthropic_payload = {
        "content": [
            {
                "type": "text",
                "text": json.dumps(
                    {
                        "description": "Use swap_tokens to exchange one token for another.",
                        "inputSchema": build_live_payload()["inputSchema"],
                        "rationale": "Provides clearer tool guidance.",
                    }
                ),
            }
        ]
    }

    with patch(
        "scoring_engine.main.httpx.AsyncClient.post",
        return_value=_AnthropicResponse(anthropic_payload),
    ):
        for _ in range(10):
            response = asyncio.run(
                app.request(
                    "POST",
                    "/api/v1/diagnose-live",
                    json=build_live_payload(),
                    headers={"X-Forwarded-For": "198.51.100.10"},
                )
            )
            assert response.status_code == 200

        response = asyncio.run(
            app.request(
                "POST",
                "/api/v1/diagnose-live",
                json=build_live_payload(),
                headers={"X-Forwarded-For": "198.51.100.10"},
            )
        )

    assert response.status_code == 429
    assert response.json()["detail"] == "Too Many Requests"


def test_diagnose_live_falls_back_when_llm_times_out(tmp_path: object) -> None:
    app = create_app(db_path=tmp_path / "reports.db")

    with patch(
        "scoring_engine.main.httpx.AsyncClient.post",
        side_effect=httpx.TimeoutException("timed out"),
    ):
        response = asyncio.run(
            app.request("POST", "/api/v1/diagnose-live", json=build_live_payload())
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["rewriteSuggestion"]["description"].startswith("Use swap_tokens")
    assert "Rewrite improves tool discoverability" in payload["rewriteSuggestion"]["rationale"]
