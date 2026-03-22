from __future__ import annotations

from typing import Any

from scoring_engine.models.report import Issue, SchemaMetrics
from scoring_engine.models.tool_input import ToolInput

AMBIGUOUS_NAMES = {
    "data", "input", "value", "args", "params", "payload", "body",
    "content", "options", "config", "request", "info", "item", "obj",
    "result", "text", "a", "b", "x", "y", "str", "num",
}


def analyze_schema_health(tool: ToolInput) -> SchemaMetrics:
    schema = tool.input_schema
    properties = schema.get("properties", {})
    required = schema.get("required", [])
    total_fields = len(properties)

    # 参数描述覆盖
    fields_with_desc = []
    fields_without_desc = []
    for name, prop in properties.items():
        if _has_description(prop):
            fields_with_desc.append(name)
        else:
            fields_without_desc.append(name)

    coverage = (len(fields_with_desc) / total_fields * 100) if total_fields else 0.0

    # 模糊命名
    ambiguous = sorted(n for n in properties if n.lower() in AMBIGUOUS_NAMES)

    # 默认值 & 枚举
    has_defaults = any(isinstance(v, dict) and "default" in v for v in properties.values())
    has_enums = any(isinstance(v, dict) and "enum" in v for v in properties.values())

    # 嵌套深度
    nesting = _max_depth(schema)

    # 生成 issues
    issues: list[Issue] = []
    for name in fields_without_desc:
        issues.append(Issue(
            field=f"inputSchema.{name}",
            severity="high",
            code="MISSING_PARAM_DESCRIPTION",
            detail=f"Parameter '{name}' has no description. Agent cannot understand its purpose.",
        ))
    for name in ambiguous:
        issues.append(Issue(
            field=f"inputSchema.{name}",
            severity="medium",
            code="AMBIGUOUS_PARAM_NAME",
            detail=f"Parameter '{name}' is too generic. Use a domain-specific name instead.",
        ))
    if len(required) > 8:
        issues.append(Issue(
            field="inputSchema.required",
            severity="medium",
            code="TOO_MANY_REQUIRED",
            detail=f"{len(required)} required params. Consider making some optional with defaults.",
        ))
    if len(required) == 0 and total_fields > 0:
        issues.append(Issue(
            field="inputSchema.required",
            severity="low",
            code="NO_REQUIRED_FIELDS",
            detail="No required fields defined. Agent may not know which params are mandatory.",
        ))

    return SchemaMetrics(
        hasSchema=True,
        totalFields=total_fields,
        requiredFields=len(required),
        fieldsWithDescription=len(fields_with_desc),
        descriptionCoverage=round(coverage, 1),
        ambiguousFieldNames=ambiguous,
        fieldsWithoutDescription=fields_without_desc,
        hasDefaults=has_defaults,
        hasEnums=has_enums,
        nestingDepth=nesting,
        issues=issues,
    )


def _has_description(item: Any) -> bool:
    return isinstance(item, dict) and bool(str(item.get("description", "")).strip())


def _max_depth(obj: Any, current: int = 0) -> int:
    if not isinstance(obj, dict):
        return current
    max_d = current
    for v in obj.values():
        if isinstance(v, dict):
            max_d = max(max_d, _max_depth(v, current + 1))
        elif isinstance(v, list):
            for item in v:
                if isinstance(item, dict):
                    max_d = max(max_d, _max_depth(item, current + 1))
    return max_d
