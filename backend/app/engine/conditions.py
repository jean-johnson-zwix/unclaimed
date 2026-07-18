from __future__ import annotations

from app.models import ConditionResult, Profile


def check_condition(cond: dict, profile: Profile, fpl: dict) -> ConditionResult:
    """Dispatch condition check by type. Returns ConditionResult with passed/detail."""
    cond_type = cond.get("type", "")
    checker = CHECKERS.get(cond_type, _check_unknown)
    return checker(cond, profile, fpl)


def _check_income_threshold(cond: dict, profile: Profile, fpl: dict) -> ConditionResult:
    value = cond.get("value", 0)
    unit = cond.get("unit", "")
    op = cond.get("operator", "<=")

    annual_income = profile.monthly_income * 12

    if unit == "pct_fpl":
        threshold_annual = int(fpl["annual"] * value / 100)
        threshold_monthly = threshold_annual // 12
        passed = _compare(annual_income, op, threshold_annual)
        detail = f"Income ${profile.monthly_income:,.0f}/mo vs {value}% FPL (${threshold_monthly:,.0f}/mo)"
    else:
        threshold_annual = value
        passed = _compare(annual_income, op, threshold_annual)
        detail = f"Income ${annual_income:,.0f}/yr vs ${threshold_annual:,.0f}/yr"

    return ConditionResult(
        condition_id=cond["id"],
        label=cond.get("label", ""),
        passed=passed,
        detail=detail,
    )


def _check_age(cond: dict, profile: Profile, fpl: dict) -> ConditionResult:
    op = cond.get("operator", ">=")
    value = cond.get("value", 0)

    if profile.age is None:
        return ConditionResult(
            condition_id=cond["id"],
            label=cond.get("label", ""),
            passed=None,
            detail="Age not provided",
        )

    passed = _compare(profile.age, op, value)
    detail = f"Age {profile.age} {op} {value}"
    return ConditionResult(
        condition_id=cond["id"],
        label=cond.get("label", ""),
        passed=passed,
        detail=detail,
    )


def _check_asset(cond: dict, profile: Profile, fpl: dict) -> ConditionResult:
    op = cond.get("operator", "<=")
    value = cond.get("value", 0)

    if profile.assets is None:
        return ConditionResult(
            condition_id=cond["id"],
            label=cond.get("label", ""),
            passed=None,
            detail="Assets not provided",
        )

    passed = _compare(profile.assets, op, value)
    detail = f"Assets ${profile.assets:,.0f} {op} ${value:,.0f}"
    return ConditionResult(
        condition_id=cond["id"],
        label=cond.get("label", ""),
        passed=passed,
        detail=detail,
    )


def _check_categorical(cond: dict, profile: Profile, fpl: dict) -> ConditionResult:
    op = cond.get("operator", "includes_any")
    required = cond.get("value", [])

    if op == "includes_any":
        passed = bool(set(profile.categories) & set(required))
        detail = f"Has {set(profile.categories) & set(required) or 'none'} of {required}"
    elif op == "excludes":
        passed = not bool(set(profile.categories) & set(required))
        detail = f"Must not have {required}; has {set(profile.categories) & set(required) or 'none'}"
    else:
        passed = False
        detail = f"Unknown operator {op}"

    return ConditionResult(
        condition_id=cond["id"],
        label=cond.get("label", ""),
        passed=passed,
        detail=detail,
    )


def _check_geographic(cond: dict, profile: Profile, fpl: dict) -> ConditionResult:
    op = cond.get("operator", "in")
    value = cond.get("value", [])

    passed = profile.state in value
    detail = f"State {profile.state} {'in' if passed else 'not in'} {value}"
    return ConditionResult(
        condition_id=cond["id"],
        label=cond.get("label", ""),
        passed=passed,
        detail=detail,
    )


def _check_clinical(cond: dict, profile: Profile, fpl: dict) -> ConditionResult:
    return ConditionResult(
        condition_id=cond["id"],
        label=cond.get("label", ""),
        passed=None,
        detail=cond.get("description", "Requires agency verification"),
    )


def _check_unknown(cond: dict, profile: Profile, fpl: dict) -> ConditionResult:
    return ConditionResult(
        condition_id=cond["id"],
        label=cond.get("label", ""),
        passed=None,
        detail=f"Unknown condition type: {cond.get('type')}",
    )


def _compare(actual: float, op: str, threshold: float) -> bool:
    if op == "<=":
        return actual <= threshold
    if op == ">=":
        return actual >= threshold
    if op == "<":
        return actual < threshold
    if op == ">":
        return actual > threshold
    if op == "==":
        return actual == threshold
    if op == "in":
        return actual in threshold
    return False


CHECKERS = {
    "income_threshold": _check_income_threshold,
    "age": _check_age,
    "asset": _check_asset,
    "categorical": _check_categorical,
    "geographic": _check_geographic,
    "clinical": _check_clinical,
    "immigration": _check_clinical,
    "disability": _check_clinical,
}
