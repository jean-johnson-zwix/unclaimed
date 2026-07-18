from __future__ import annotations

from app.clients.fpl import get_fpl
from app.engine.conditions import check_condition
from app.graph.store import graph_store
from app.models import ConditionResult, EligibilityResult, Profile


def evaluate_program(program_id: str, profile: Profile) -> EligibilityResult | None:
    program = graph_store.get_program(program_id)
    if not program:
        return None

    fpl = get_fpl(profile.household_size, profile.state)
    source_url = program.get("apply_url", "")

    cat_sources = graph_store.get_categorical_sources(program_id)
    for src in cat_sources:
        if src["source_program"] in profile.enrolled_in:
            return EligibilityResult(
                program_id=program_id,
                program_name=program.get("name", ""),
                category=program.get("category", ""),
                verdict="likely_eligible",
                matched=[ConditionResult(
                    condition_id=f"categorical:{src['source_program']}",
                    label=f"Auto-qualifies via {src['source_program'].upper()}",
                    passed=True,
                    detail=f"Enrollment in {src['source_program'].upper()} categorically qualifies for this program",
                    source_url=source_url,
                )],
                apply_url=source_url,
                effective_date=program.get("effective_date", ""),
            )

    # Step 2: Collect adjunctively satisfied conditions via STREAMLINES
    adjunctive_satisfied: set[str] = set()
    stream_sources = graph_store.get_streamline_sources(program_id)
    for src in stream_sources:
        if src["source_program"] in profile.enrolled_in:
            for cond_id in src.get("satisfies", []):
                adjunctive_satisfied.add(cond_id)

    # Step 3: Evaluate remaining conditions (group by logic_group)
    conditions = graph_store.get_conditions(program_id)

    # Organize into logic groups: same group = OR'd, groups AND'd
    groups: dict[str | None, list[dict]] = {}
    for cond in conditions:
        group = cond.get("logic_group")
        groups.setdefault(group, []).append(cond)

    matched: list[ConditionResult] = []
    failed: list[ConditionResult] = []
    needs_verification: list[ConditionResult] = []

    for group_key, group_conds in groups.items():
        if group_key is None:
            # No group = each condition is AND'd independently
            for cond in group_conds:
                _eval_single(cond, profile, fpl, adjunctive_satisfied, source_url, matched, failed, needs_verification)
        else:
            _eval_or_group(group_conds, profile, fpl, adjunctive_satisfied, source_url, matched, failed, needs_verification)

    # Step 4: Verdict resolution
    has_hard_fail = any(
        r.passed is False
        for r in failed
        if _is_hard_gate(r.condition_id, conditions)
    )

    if has_hard_fail:
        verdict = "ineligible"
    elif needs_verification:
        verdict = "uncertain"
    else:
        verdict = "likely_eligible"

    return EligibilityResult(
        program_id=program_id,
        program_name=program.get("name", ""),
        category=program.get("category", ""),
        verdict=verdict,
        matched=matched,
        failed=failed,
        needs_verification=needs_verification,
        apply_url=source_url,
        effective_date=program.get("effective_date", ""),
    )


def _eval_single(
    cond: dict,
    profile: Profile,
    fpl: dict,
    adjunctive_satisfied: set[str],
    source_url: str,
    matched: list[ConditionResult],
    failed: list[ConditionResult],
    needs_verification: list[ConditionResult],
) -> None:
    cond_id = cond["id"]

    if cond_id in adjunctive_satisfied:
        matched.append(ConditionResult(
            condition_id=cond_id,
            label=cond.get("label", ""),
            passed=True,
            detail="Satisfied via current enrollment",
            source_url=source_url,
        ))
        return

    if not cond.get("verifiable", True):
        needs_verification.append(ConditionResult(
            condition_id=cond_id,
            label=cond.get("label", ""),
            passed=None,
            detail=cond.get("description", "Requires agency verification"),
            source_url=source_url,
        ))
        return

    result = check_condition(cond, profile, fpl)
    result.source_url = source_url
    if result.passed is True:
        matched.append(result)
    elif result.passed is False:
        failed.append(result)
    else:
        needs_verification.append(result)


def _eval_or_group(
    group_conds: list[dict],
    profile: Profile,
    fpl: dict,
    adjunctive_satisfied: set[str],
    source_url: str,
    matched: list[ConditionResult],
    failed: list[ConditionResult],
    needs_verification: list[ConditionResult],
) -> None:
    results: list[ConditionResult] = []
    any_passed = False
    any_unverifiable = False

    for cond in group_conds:
        cond_id = cond["id"]

        if cond_id in adjunctive_satisfied:
            matched.append(ConditionResult(
                condition_id=cond_id,
                label=cond.get("label", ""),
                passed=True,
                detail="Satisfied via current enrollment",
                source_url=source_url,
            ))
            return

        if not cond.get("verifiable", True):
            any_unverifiable = True
            results.append(ConditionResult(
                condition_id=cond_id,
                label=cond.get("label", ""),
                passed=None,
                detail=cond.get("description", "Requires agency verification"),
                source_url=source_url,
            ))
            continue

        result = check_condition(cond, profile, fpl)
        result.source_url = source_url
        results.append(result)
        if result.passed is True:
            any_passed = True

    if any_passed:
        for r in results:
            if r.passed is True:
                matched.append(r)
    elif any_unverifiable:
        for r in results:
            if r.passed is None:
                needs_verification.append(r)
    else:
        for r in results:
            failed.append(r)


def _is_hard_gate(condition_id: str, conditions: list[dict]) -> bool:
    for c in conditions:
        if c["id"] == condition_id:
            return c.get("hard_gate", False)
    return False
