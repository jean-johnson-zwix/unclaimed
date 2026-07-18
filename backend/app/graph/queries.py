from __future__ import annotations

from app.graph.store import graph_store
from app.models import Profile


def query_candidate_programs(profile: Profile) -> list[str]:
    """Cheap shortlist: exclude programs that obviously don't apply based on
    categorical hard gates (e.g. senior-only for a 25-year-old, child-required
    for a childless adult). Income checks happen later in the engine."""
    candidates = []
    for prog in graph_store.all_programs():
        pid = prog["id"]
        conditions = graph_store.get_conditions(pid)
        if _fails_cheap_gate(conditions, profile):
            continue
        candidates.append(pid)
    return candidates


def _fails_cheap_gate(conditions: list[dict], profile: Profile) -> bool:
    for cond in conditions:
        if not cond.get("hard_gate", False):
            continue
        cond_type = cond.get("type", "")

        if cond_type == "geographic":
            values = cond.get("value", [])
            if values and profile.state not in values:
                return True

        if cond_type == "categorical" and cond.get("operator") == "includes_any":
            required = set(cond.get("value", []))
            if required and not (required & set(profile.categories)):
                return True

    return False
