from __future__ import annotations

import re

from scoring_engine.models.report import DescriptionMetrics, Issue
from scoring_engine.models.tool_input import ToolInput

ACTION_VERBS = [
    "get", "set", "create", "delete", "update", "search", "list",
    "fetch", "send", "query", "read", "write", "find", "check",
    "run", "start", "stop", "swap", "deploy", "connect", "execute",
]
USE_CASE_PATTERNS = [
    "use this", "when you", "allows you", "enables", "provides",
    "used for", "designed to", "helps", "can be used",
]
EXAMPLE_MARKERS = ["example", "e.g.", "for example", "such as"]
JARGON_TERMS = {"mcp", "stdio", "sse", "rpc", "grpc", "websocket", "middleware"}


def analyze_discoverability(tool: ToolInput) -> DescriptionMetrics:
    desc = tool.description.strip()
    dl = desc.lower()
    length = len(desc)

    # 动作动词
    verb_found = None
    for v in ACTION_VERBS:
        if dl.startswith(v) or f" {v} " in dl:
            verb_found = v
            break
    has_action_verb = verb_found is not None

    # 使用场景
    has_use_case = any(p in dl for p in USE_CASE_PATTERNS)

    # 示例
    has_example = any(k in dl for k in EXAMPLE_MARKERS)

    # 语义密度
    words = desc.split()
    unique_ratio = len(set(w.lower() for w in words)) / len(words) if words else 0.0

    # jargon
    jargon = sorted(t for t in JARGON_TERMS if t in dl)

    # 缺失元素
    missing: list[str] = []
    if not has_action_verb:
        missing.append("action_verb")
    if not has_use_case:
        missing.append("use_case_pattern")
    if not has_example:
        missing.append("example")
    if length < 20:
        missing.append("sufficient_length")

    # issues
    issues: list[Issue] = []
    if not has_action_verb:
        issues.append(Issue(
            field="description",
            severity="high",
            code="MISSING_ACTION_VERB",
            detail="Description should start with an action verb (e.g., 'Get', 'Create', 'Swap').",
        ))
    if not has_use_case:
        issues.append(Issue(
            field="description",
            severity="high",
            code="MISSING_USE_CASE",
            detail="No 'Use this when...' pattern. Agent cannot match tool to ambiguous intents.",
        ))
    if not has_example:
        issues.append(Issue(
            field="description",
            severity="medium",
            code="MISSING_EXAMPLE",
            detail="No usage example. Agent lacks concrete reference for parameter filling.",
        ))
    if length < 20:
        issues.append(Issue(
            field="description",
            severity="critical",
            code="DESCRIPTION_TOO_SHORT",
            detail=f"Description is only {length} chars. Minimum 20 recommended for discovery.",
        ))
    if length > 500:
        issues.append(Issue(
            field="description",
            severity="low",
            code="DESCRIPTION_TOO_LONG",
            detail=f"Description is {length} chars. Over 500 may dilute key information.",
        ))
    if jargon and not has_use_case and not has_example:
        issues.append(Issue(
            field="description",
            severity="medium",
            code="JARGON_WITHOUT_CONTEXT",
            detail=f"Jargon terms ({', '.join(jargon)}) without use-case or examples.",
        ))

    return DescriptionMetrics(
        length=length,
        hasActionVerb=has_action_verb,
        actionVerbFound=verb_found,
        hasUseCase=has_use_case,
        hasExample=has_example,
        semanticDensity=round(unique_ratio, 2),
        jargonTerms=jargon,
        missingElements=missing,
        issues=issues,
    )
