from __future__ import annotations

from scoring_engine.models.report import CallabilityMetrics, Issue, PromptTestResult
from scoring_engine.models.tool_input import ToolInput
from scoring_engine.task_generator import generate_test_prompts


TIER_MAP = {"direct": "T1", "ambiguous": "T2", "competitive": "T3"}


async def evaluate_callability(tool: ToolInput, llm_client: object) -> CallabilityMetrics:
    if not tool.run_llm_test:
        tests = [
            PromptTestResult(
                tier=TIER_MAP[pt], prompt_type=pt, prompt=prompt,
                outcome="skipped", reasoning="LLM test disabled",
            )
            for pt, prompt in generate_test_prompts(tool).items()
        ]
        return CallabilityMetrics(
            testsRun=len(tests), invokeCount=0, mentionCount=0,
            silentCount=0, errorCount=0, skipped=True,
            testDetails=tests, issues=[],
        )

    tests: list[PromptTestResult] = []
    prompts = generate_test_prompts(tool)
    for prompt_type, prompt in prompts.items():
        try:
            result = await llm_client.evaluate_tool(prompt_type, prompt, tool)
            outcome = str(result.get("outcome", "silent"))
            reasoning = str(result.get("reasoning", "")).strip() or None
        except Exception as exc:
            outcome = "error"
            reasoning = str(exc)
        tests.append(PromptTestResult(
            tier=TIER_MAP[prompt_type], prompt_type=prompt_type,
            prompt=prompt, outcome=outcome, reasoning=reasoning,
        ))

    invoke_count = sum(1 for t in tests if t.outcome == "invoked")
    mention_count = sum(1 for t in tests if t.outcome == "mentioned")
    silent_count = sum(1 for t in tests if t.outcome == "silent")
    error_count = sum(1 for t in tests if t.outcome == "error")

    # issues
    issues: list[Issue] = []
    if silent_count > 0:
        issues.append(Issue(
            field="tool_definition",
            severity="high",
            code="AGENT_IGNORED_TOOL",
            detail=f"Agent ignored tool in {silent_count}/{len(tests)} tests. Description may be unclear.",
        ))
    if mention_count > invoke_count:
        issues.append(Issue(
            field="inputSchema",
            severity="high",
            code="MENTIONED_BUT_NOT_INVOKED",
            detail=f"Agent mentioned tool {mention_count}x but only invoked {invoke_count}x. Schema may be unclear.",
        ))
    if error_count > 0:
        issues.append(Issue(
            field="tool_definition",
            severity="critical",
            code="INVOCATION_ERROR",
            detail=f"Agent encountered errors in {error_count}/{len(tests)} tests.",
        ))

    return CallabilityMetrics(
        testsRun=len(tests), invokeCount=invoke_count,
        mentionCount=mention_count, silentCount=silent_count,
        errorCount=error_count, skipped=False,
        testDetails=tests, issues=issues,
    )
