from __future__ import annotations

from app.engine.evaluate import evaluate_program
from app.graph.queries import query_candidate_programs
from app.graph.store import graph_store
from app.models import Disclaimers, EligibilityResult, Profile, Unlock


def run_pipeline(profile: Profile) -> dict:
    candidate_ids = query_candidate_programs(profile)
    results: list[EligibilityResult] = []

    for pid in candidate_ids:
        result = evaluate_program(pid, profile)
        if result and result.verdict != "ineligible":
            result.unlocks = _get_unlocks(pid)
            results.append(result)

    results.sort(key=_sort_key)

    return {
        "resolved_profile": profile.model_dump(),
        "results": [r.model_dump() for r in results],
        "summary": {
            "likely_eligible": sum(1 for r in results if r.verdict == "likely_eligible"),
            "uncertain": sum(1 for r in results if r.verdict == "uncertain"),
            "programs_checked": len(candidate_ids),
            "estimated_total_annual": None,
        },
        "disclaimers": Disclaimers().model_dump(),
        "meta": {"fpl_year": 2026, "mode": "pipeline"},
    }


def run_unlock(program_id: str) -> dict | None:
    program = graph_store.get_program(program_id)
    if not program:
        return None

    nodes, edges = graph_store.expand_categorical(program_id)

    return {
        "root": program_id,
        "root_name": program.get("name", ""),
        "nodes": nodes,
        "edges": edges,
        "disclaimers": {
            "not_a_determination": Disclaimers().not_a_determination,
            "general": "Categorical links reflect rules effective as of the dates shown.",
        },
    }


def _get_unlocks(program_id: str) -> list[Unlock]:
    unlocks = []
    nodes, edges = graph_store.expand_categorical(program_id)
    for node in nodes:
        if node["id"] == program_id:
            continue
        unlocks.append(Unlock(
            program_id=node["id"],
            program_name=node.get("name", ""),
            relation=node.get("relation_in", ""),
            hop=node.get("hop", 1),
            satisfies=_find_satisfies(node["id"], edges),
        ))
    return unlocks


def _find_satisfies(target_id: str, edges: list[dict]) -> list[str] | None:
    for e in edges:
        if e["target"] == target_id and e.get("satisfies"):
            return e["satisfies"]
    return None


def _sort_key(r: EligibilityResult) -> tuple:
    verdict_order = {"likely_eligible": 0, "uncertain": 1, "ineligible": 2}
    return (verdict_order.get(r.verdict, 9), -len(r.unlocks))
