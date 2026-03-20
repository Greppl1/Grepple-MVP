from __future__ import annotations

from scoring_engine.models.tool_input import ToolInput


def generate_test_prompts(tool: ToolInput) -> dict[str, str]:
    category_hint = tool.category.replace("_", " ")
    return {
        "direct": (
            f"A user explicitly wants to use {tool.name}. Decide whether to call the tool for this request: "
            f"'Please use {tool.name} to handle this {category_hint} task.'"
        ),
        "ambiguous": (
            f"A user gives an underspecified {category_hint} request. Decide if {tool.name} is relevant and whether "
            f"you have enough information to call it: 'Help me with a {category_hint} operation right now.'"
        ),
        "competitive": (
            f"A user request could match several tools in {category_hint}. Choose whether {tool.name} is the best fit: "
            f"'I need the best tool to solve a {category_hint} job with minimal extra clarification.'"
        ),
    }
