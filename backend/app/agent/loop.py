from __future__ import annotations

import json
import logging
from typing import Any

from openai import AsyncOpenAI

from app.agent.prompts import SCREENING_SYSTEM_PROMPT
from app.agent.tools import TOOL_SCHEMAS, dispatch_tool
from app.clients.benefit_estimate import estimate_benefit
from app.guardrails.format import enforce_guardrails
from app.llm import get_providers
from app.models import Disclaimers, EligibilityResult, Profile

log = logging.getLogger(__name__)

MAX_ITERATIONS = 15


async def run_agent_loop(profile: Profile) -> dict:
    providers = get_providers()
    if not providers:
        raise RuntimeError("No LLM providers configured")

    profile_dict = profile.model_dump()

    # ponytail: deterministic pre-seeding - gather results ourselves, then ask LLM to explain
    fpl = dispatch_tool("get_fpl", {"household_size": profile.household_size, "state": profile.state})
    log.warning("[agent] tool=get_fpl | result=%s", fpl)

    candidates = dispatch_tool("query_candidate_programs", {"profile": profile_dict})
    log.warning("[agent] tool=query_candidate_programs | count=%d | ids=%s", candidates["count"], candidates["candidate_program_ids"])

    results: list[dict] = []
    for pid in candidates["candidate_program_ids"]:
        r = dispatch_tool("evaluate_program", {"program_id": pid, "profile": profile_dict})
        log.warning("[agent] tool=evaluate_program | program=%s | verdict=%s", pid, r.get("verdict", r.get("error", "?")))
        if "verdict" in r:
            r["estimated_benefit"] = estimate_benefit(pid, profile)
            results.append(r)

    for pid in profile.enrolled_in:
        expansion = dispatch_tool("expand_categorical", {"program_id": pid})
        log.warning("[agent] tool=expand_categorical | program=%s | unlocked=%d nodes", pid, len(expansion.get("nodes", [])))

    eligible = [r for r in results if r.get("verdict") != "ineligible"]
    eligible.sort(key=lambda r: (0 if r["verdict"] == "likely_eligible" else 1, r.get("program_id", "")))

    explanation = await _get_explanation(providers, profile_dict, eligible)

    output = {
        "resolved_profile": profile_dict,
        "results": eligible,
        "summary": {
            "likely_eligible": sum(1 for r in eligible if r["verdict"] == "likely_eligible"),
            "uncertain": sum(1 for r in eligible if r["verdict"] == "uncertain"),
            "programs_checked": len(results),
            "estimated_total_annual": sum(
                r["estimated_benefit"]["estimated_annual"]
                for r in eligible
                if r.get("estimated_benefit") and r["verdict"] == "likely_eligible"
            ) or None,
            "explanation": explanation,
        },
        "disclaimers": Disclaimers().model_dump(),
        "meta": {"mode": "agent", "tool_calls": len(candidates["candidate_program_ids"]) + 2},
    }
    return enforce_guardrails(output)


async def _get_explanation(providers, profile: dict, results: list[dict]) -> str:
    """Ask the LLM to narrate the results in hedged natural language."""
    if not results:
        return "No programs found matching this profile."

    findings = []
    for r in results[:15]:
        entry = {"program": r.get("program_name", r["program_id"]), "verdict": r["verdict"]}
        if r.get("matched"):
            entry["reasons"] = [m["label"] for m in r["matched"][:3]]
        if r.get("needs_verification"):
            entry["needs_verification"] = [n["label"] for n in r["needs_verification"]]
        findings.append(entry)

    summary_data = json.dumps({"findings": findings}, default=str)

    messages = [
        {"role": "system", "content": "You explain government benefits screening results. Reference the specific conditions that matched (from the 'reasons' field). Use hedged language: 'appears likely eligible', 'may qualify'. Never say 'you qualify'. Be concise - 3-5 sentences max."},
        {"role": "user", "content": f"Explain these results to the user, referencing the specific conditions that matched:\n{summary_data}"},
    ]

    for p in providers:
        if not p.rate_limiter.is_allowed():
            continue
        try:
            client = AsyncOpenAI(base_url=p.base_url, api_key=p.api_key)
            extra: dict[str, Any] = {}
            if p.extra_headers:
                extra["extra_headers"] = p.extra_headers
            p.rate_limiter.record()
            log.warning("[agent] llm_call=explanation | provider=%s | model=%s", p.name, p.model)
            resp = await client.chat.completions.create(
                model=p.model,
                messages=messages,
                temperature=0.3,
                max_tokens=150,
                **extra,
            )
            text = resp.choices[0].message.content or ""
            log.warning("[agent] llm_result=explanation | provider=%s | response=%s", p.name, text[:200])
            return text
        except Exception as e:
            log.warning("[agent] llm_error=explanation | provider=%s | error=%s", p.name, e)

    return ""
