from __future__ import annotations

import json
from typing import Any

from app.clients.fpl import get_fpl
from app.engine.evaluate import evaluate_program
from app.graph.queries import query_candidate_programs
from app.graph.store import graph_store
from app.models import Profile


TOOL_SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_fpl",
            "description": "Get Federal Poverty Level thresholds for a household size and state.",
            "parameters": {
                "type": "object",
                "properties": {
                    "household_size": {"type": "integer", "description": "Number of people in the household"},
                    "state": {"type": "string", "default": "AZ"},
                    "year": {"type": "integer", "default": 2026},
                },
                "required": ["household_size"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_candidate_programs",
            "description": "Get a shortlist of program IDs the profile might qualify for based on cheap demographic/geographic gates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "profile": {"type": "object", "description": "User profile with household_size, monthly_income, state, age, categories, enrolled_in, assets, immigration_status"},
                },
                "required": ["profile"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "evaluate_program",
            "description": "Run the deterministic eligibility engine for a specific program against the user profile. Returns verdict (likely_eligible/uncertain/ineligible) with matched/failed conditions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "program_id": {"type": "string"},
                    "profile": {"type": "object"},
                },
                "required": ["program_id", "profile"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "expand_categorical",
            "description": "Traverse the knowledge graph to find programs unlocked by enrollment in the given program (up to 2 hops via CATEGORICALLY_QUALIFIES and STREAMLINES edges).",
            "parameters": {
                "type": "object",
                "properties": {
                    "program_id": {"type": "string"},
                },
                "required": ["program_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_missing_fields",
            "description": "Given a program and profile, return the list of fields that are missing or unverifiable, preventing a definitive eligibility determination.",
            "parameters": {
                "type": "object",
                "properties": {
                    "program_id": {"type": "string"},
                    "profile": {"type": "object"},
                },
                "required": ["program_id", "profile"],
            },
        },
    },
]


def dispatch_tool(name: str, arguments: dict[str, Any]) -> Any:
    if name == "get_fpl":
        return get_fpl(
            arguments["household_size"],
            arguments.get("state", "AZ"),
            arguments.get("year", 2026),
        )

    if name == "query_candidate_programs":
        profile = Profile(**arguments["profile"])
        ids = query_candidate_programs(profile)
        return {"candidate_program_ids": ids, "count": len(ids)}

    if name == "evaluate_program":
        profile = Profile(**arguments["profile"])
        result = evaluate_program(arguments["program_id"], profile)
        if result is None:
            return {"error": f"Program '{arguments['program_id']}' not found"}
        return result.model_dump()

    if name == "expand_categorical":
        nodes, edges = graph_store.expand_categorical(arguments["program_id"])
        return {"nodes": nodes, "edges": edges}

    if name == "get_missing_fields":
        return _get_missing_fields(arguments["program_id"], Profile(**arguments["profile"]))

    return {"error": f"Unknown tool: {name}"}


def _get_missing_fields(program_id: str, profile: Profile) -> dict:
    conditions = graph_store.get_conditions(program_id)
    missing = []
    for c in conditions:
        if not c.get("verifiable", True):
            missing.append({"condition_id": c["id"], "description": c.get("description", ""), "reason": "requires agency verification"})
            continue
        ctype = c.get("type", "")
        if ctype == "income_threshold" and profile.monthly_income == 0:
            missing.append({"condition_id": c["id"], "description": c.get("description", ""), "reason": "income not provided"})
        elif ctype == "age" and profile.age is None:
            missing.append({"condition_id": c["id"], "description": c.get("description", ""), "reason": "age not provided"})
        elif ctype == "asset" and profile.assets is None:
            missing.append({"condition_id": c["id"], "description": c.get("description", ""), "reason": "assets not provided"})
    return {"program_id": program_id, "missing_fields": missing}
