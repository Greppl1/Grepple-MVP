"""Score formulas for human-readable frontend display.

These formulas convert raw DiagnosticReport metrics into 0-100 scores.
The scoring engine itself does NOT output scores — this module is provided
as a reference implementation for frontend or report-layer consumers.

Each dimension score reflects how well the tool serves agent usability:
- Schema Health: Can the agent correctly construct parameters?
- Discoverability: Can the agent find and understand the tool?
- Callability: Can the agent successfully invoke the tool?
"""

from __future__ import annotations

from dataclasses import dataclass

from scoring_engine.models.report import (
    CallabilityMetrics,
    DescriptionMetrics,
    DiagnosticReport,
    SchemaMetrics,
)


@dataclass(frozen=True)
class DimensionScore:
    """A single dimension's score with breakdown."""

    total: int  # 0-100
    breakdown: dict[str, float]  # component name → points earned


@dataclass(frozen=True)
class ToolScores:
    """All dimension scores for a tool, intended for frontend display."""

    schema_health: DimensionScore
    discoverability: DimensionScore
    callability: DimensionScore
    overall: int  # weighted average 0-100
    grade: str  # A/B/C/D/F


def compute_schema_health(m: SchemaMetrics) -> DimensionScore:
    """Schema Health: Can the agent correctly construct parameters?

    Components (total 100):
      - has_schema gate: false → 0
      - description_coverage (35): field descriptions are critical for agent
      - ambiguous_names (20): penalty per ambiguous name
      - undescribed_fields (15): fields without description = agent guessing
      - required_ratio (10): too many (>5) or zero required fields is bad
      - has_defaults (5): defaults lower invocation barrier
      - has_enums (5): enum constraints reduce agent errors
      - nesting_depth (10): deep nesting increases construction difficulty
    """
    if not m.has_schema:
        return DimensionScore(total=0, breakdown={"has_schema": 0})

    # description_coverage: 0-1 → 0-35
    coverage_pts = m.description_coverage * 35

    # ambiguous names: each ambiguous name costs 5 pts, max 20 penalty
    ambiguous_penalty = min(len(m.ambiguous_field_names) * 5, 20)
    ambiguous_pts = 20 - ambiguous_penalty

    # undescribed fields: each costs 3 pts, max 15 penalty
    undescribed_penalty = min(len(m.fields_without_description) * 3, 15)
    undescribed_pts = 15 - undescribed_penalty

    # required ratio: sweet spot is 1-5 required fields
    if m.total_fields == 0:
        required_pts = 0.0
    elif m.required_fields == 0:
        required_pts = 3.0  # no required = ambiguous what's needed
    elif m.required_fields > 5:
        over = m.required_fields - 5
        required_pts = max(10 - over * 2, 0)
    else:
        required_pts = 10.0

    # has_defaults: binary bonus
    defaults_pts = 5.0 if m.has_defaults else 0.0

    # has_enums: binary bonus
    enums_pts = 5.0 if m.has_enums else 0.0

    # nesting_depth: 1 = full points, each level above 3 costs 3 pts
    if m.nesting_depth <= 3:
        nesting_pts = 10.0
    else:
        over = m.nesting_depth - 3
        nesting_pts = max(10 - over * 3, 0)

    total = (
        coverage_pts
        + ambiguous_pts
        + undescribed_pts
        + required_pts
        + defaults_pts
        + enums_pts
        + nesting_pts
    )

    return DimensionScore(
        total=_clamp(round(total)),
        breakdown={
            "description_coverage": round(coverage_pts, 1),
            "ambiguous_names": round(ambiguous_pts, 1),
            "undescribed_fields": round(undescribed_pts, 1),
            "required_ratio": round(required_pts, 1),
            "has_defaults": round(defaults_pts, 1),
            "has_enums": round(enums_pts, 1),
            "nesting_depth": round(nesting_pts, 1),
        },
    )


def compute_discoverability(m: DescriptionMetrics) -> DimensionScore:
    """Discoverability: Can the agent find and understand the tool?

    Components (total 100):
      - action_verb (20): verb tells agent what the tool does
      - use_case (20): scenario tells agent when to use it
      - example (15): example tells agent how to use it
      - length_sweet_spot (15): 30-300 chars is ideal
      - semantic_density (15): high info density = less noise
      - jargon_penalty (10): unexplained jargon confuses agents
      - completeness (5): bonus for having all elements
    """
    # action verb: binary
    verb_pts = 20.0 if m.has_action_verb else 0.0

    # use case: binary
    usecase_pts = 20.0 if m.has_use_case else 0.0

    # example: binary
    example_pts = 15.0 if m.has_example else 0.0

    # length sweet spot: 30-300 is ideal
    if m.length < 10:
        length_pts = 0.0
    elif m.length < 30:
        length_pts = (m.length - 10) / 20 * 15  # ramp up 10-30
    elif m.length <= 300:
        length_pts = 15.0  # sweet spot
    elif m.length <= 500:
        length_pts = 15 - (m.length - 300) / 200 * 10  # gentle decline
    else:
        length_pts = 5.0  # too long but still has content

    # semantic density: 0-1 → 0-15
    density_pts = m.semantic_density * 15

    # jargon penalty: each term costs 2.5 pts, max 10
    jargon_penalty = min(len(m.jargon_terms) * 2.5, 10)
    jargon_pts = 10 - jargon_penalty

    # completeness bonus: 0 missing = 5, each missing = -1.25
    missing_count = len(m.missing_elements)
    completeness_pts = max(5 - missing_count * 1.25, 0)

    total = (
        verb_pts
        + usecase_pts
        + example_pts
        + length_pts
        + density_pts
        + jargon_pts
        + completeness_pts
    )

    return DimensionScore(
        total=_clamp(round(total)),
        breakdown={
            "action_verb": round(verb_pts, 1),
            "use_case": round(usecase_pts, 1),
            "example": round(example_pts, 1),
            "length_sweet_spot": round(length_pts, 1),
            "semantic_density": round(density_pts, 1),
            "jargon_clarity": round(jargon_pts, 1),
            "completeness": round(completeness_pts, 1),
        },
    )


def compute_callability(m: CallabilityMetrics) -> DimensionScore:
    """Callability: Can the agent successfully invoke the tool?

    Components (total 100):
      - invocation_rate (50): invoke_count / tests_run
      - error_free (25): errors are severe failures
      - visibility (15): not being silent means at least discoverable
      - friction (10): mention > invoke gap = schema friction

    If skipped (no LLM test), returns -1 total to signal "not tested".
    """
    if m.skipped or m.tests_run == 0:
        return DimensionScore(total=-1, breakdown={"skipped": -1})

    # invocation rate: most critical metric
    invoke_rate = m.invoke_count / m.tests_run
    invoke_pts = invoke_rate * 50

    # error free: each error costs proportionally
    error_rate = m.error_count / m.tests_run
    error_pts = (1 - error_rate) * 25

    # visibility: not silent = agent at least noticed the tool
    silent_rate = m.silent_count / m.tests_run
    visibility_pts = (1 - silent_rate) * 15

    # friction: gap between mention and invoke indicates schema issues
    if m.mention_count > 0 and m.invoke_count < m.mention_count:
        friction_rate = (m.mention_count - m.invoke_count) / m.mention_count
        friction_pts = (1 - friction_rate) * 10
    elif m.invoke_count > 0:
        friction_pts = 10.0  # no friction
    else:
        friction_pts = 0.0  # never even mentioned

    total = invoke_pts + error_pts + visibility_pts + friction_pts

    return DimensionScore(
        total=_clamp(round(total)),
        breakdown={
            "invocation_rate": round(invoke_pts, 1),
            "error_free": round(error_pts, 1),
            "visibility": round(visibility_pts, 1),
            "friction": round(friction_pts, 1),
        },
    )


def compute_scores(report: DiagnosticReport) -> ToolScores:
    """Compute all scores from a DiagnosticReport.

    Overall is a weighted average:
      - Schema Health: 30%  (foundational but fixable)
      - Discoverability: 30% (agent needs to find it)
      - Callability: 40%  (most important — does it actually work?)

    If callability was skipped, overall is based on schema + discoverability only.
    """
    schema = compute_schema_health(report.metrics.schema_health)
    discovery = compute_discoverability(report.metrics.description)
    callability = compute_callability(report.metrics.callability)

    if callability.total < 0:
        # Callability not tested — weight schema and discoverability equally
        raw_overall = schema.total * 0.5 + discovery.total * 0.5
    else:
        raw_overall = (
            schema.total * 0.3 + discovery.total * 0.3 + callability.total * 0.4
        )

    overall = _clamp(round(raw_overall))
    grade = _to_grade(overall)

    return ToolScores(
        schema_health=schema,
        discoverability=discovery,
        callability=callability,
        overall=overall,
        grade=grade,
    )


def scores_to_dict(scores: ToolScores) -> dict[str, object]:
    """Serialize ToolScores to a JSON-friendly dict for frontend consumption."""
    callability_total = (
        scores.callability.total if scores.callability.total >= 0 else None
    )
    return {
        "schemaHealth": {
            "score": scores.schema_health.total,
            "breakdown": scores.schema_health.breakdown,
        },
        "discoverability": {
            "score": scores.discoverability.total,
            "breakdown": scores.discoverability.breakdown,
        },
        "callability": {
            "score": callability_total,
            "skipped": callability_total is None,
            "breakdown": scores.callability.breakdown
            if callability_total is not None
            else {},
        },
        "overall": scores.overall,
        "grade": scores.grade,
    }


def _clamp(value: int) -> int:
    return max(0, min(100, value))


def _to_grade(score: int) -> str:
    if score >= 90:
        return "A"
    if score >= 75:
        return "B"
    if score >= 60:
        return "C"
    if score >= 40:
        return "D"
    return "F"
