from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

HHS_API_URL = "https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines/api/{year}/{state}/{household_size}"

FALLBACK_2026 = {
    "base": 15960,
    "per_person": 5680,
}

_cache: dict[tuple[int, str, int], dict] = {}


def get_fpl(household_size: int, state: str = "AZ", year: int = 2026) -> dict:
    """Returns {"annual": int, "monthly": int, "year": int, "stale": bool}."""
    key = (household_size, state, year)
    if key in _cache:
        return _cache[key]

    result = _fetch_from_api(household_size, state, year)
    if result:
        _cache[key] = result
        return result

    logger.warning("FPL API unavailable, using fallback values for %s", key)
    result = _compute_fallback(household_size, year)
    _cache[key] = result
    return result


def _fetch_from_api(household_size: int, state: str, year: int) -> dict | None:
    url = HHS_API_URL.format(year=year, state=state, household_size=household_size)
    try:
        resp = httpx.get(url, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        annual = data.get("poverty_guideline") or data.get("amount")
        if annual:
            return {"annual": int(annual), "monthly": int(annual) // 12, "year": year, "stale": False}
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as e:
        logger.debug("FPL API error: %s", e)
    return None


def _compute_fallback(household_size: int, year: int) -> dict:
    annual = FALLBACK_2026["base"] + FALLBACK_2026["per_person"] * max(0, household_size - 1)
    return {"annual": annual, "monthly": annual // 12, "year": year, "stale": True}


def fpl_for_percentage(household_size: int, pct: float, state: str = "AZ", year: int = 2026) -> dict:
    """Returns the dollar threshold for a given FPL percentage.
    e.g. fpl_for_percentage(3, 185) -> {"annual": ..., "monthly": ...}"""
    fpl = get_fpl(household_size, state, year)
    annual = int(fpl["annual"] * pct / 100)
    return {"annual": annual, "monthly": annual // 12}
