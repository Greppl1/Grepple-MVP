from __future__ import annotations

from copy import deepcopy

from scoring_engine.models.report import Diagnosis, RewriteSuggestion
from scoring_engine.models.tool_input import ToolInput


async def rewrite_tool(
    tool: ToolInput,
    llm_client: object,
    diagnosis: Diagnosis,
) -> RewriteSuggestion:
    try:
        llm_rewrite = await llm_client.rewrite_tool(tool, diagnosis)
        if llm_rewrite:
            return RewriteSuggestion.model_validate(llm_rewrite)
    except Exception:
        llm_rewrite = None
    schema = deepcopy(tool.input_schema)
    first_property = next(iter(schema.get("properties", {})), None)
    if first_property and "examples" not in schema:
        schema["examples"] = [{first_property: f"example_{first_property}"}]
    description = (
        f"Use {tool.name} when the user explicitly needs a {tool.category.replace('_', ' ')} action. "
        f"Provide every required parameter exactly as defined in the schema and avoid calling it for unrelated tasks. "
        f"Example request: ask for {tool.name} with concrete values before execution."
    )
    return RewriteSuggestion(
        description=description,
        inputSchema=schema,
        rationale=(
            "Rewrite improves tool discoverability and callability using the current diagnosis: "
            f"{diagnosis.failure_mode} ({diagnosis.root_cause or 'no root cause provided'})."
        ),
    )
