from __future__ import annotations

import json
import logging
from typing import Any

from openai import AsyncOpenAI

from app.agent.prompts import SCREENING_SYSTEM_PROMPT
from app.agent.tools import TOOL_SCHEMAS, dispatch_tool
from app.guardrails.format import enforce_guardrails
from app.llm import get_providers
from app.models import Profile

log = logging.getLogger(__name__)

MAX_ITERATIONS = 10


async def run_agent_loop(profile: Profile) -> dict:
    providers = get_providers()
    if not providers:
        raise RuntimeError("No LLM providers configured")

    profile_json = profile.model_dump_json()
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SCREENING_SYSTEM_PROMPT},
        {"role": "user", "content": f"Screen this profile for eligible benefits:\n{profile_json}"},
    ]

    last_err: Exception | None = None
    for p in providers:
        if not p.rate_limiter.is_allowed():
            continue
        try:
            result = await _loop_with_provider(p, messages)
            return result
        except Exception as e:
            log.warning("Agent loop failed with provider %s: %s", p.name, e)
            last_err = e

    raise RuntimeError("Agent loop failed on all providers") from last_err


async def _loop_with_provider(provider, messages: list[dict[str, Any]]) -> dict:
    client = AsyncOpenAI(base_url=provider.base_url, api_key=provider.api_key)
    extra: dict[str, Any] = {}
    if provider.extra_headers:
        extra["extra_headers"] = provider.extra_headers

    for _ in range(MAX_ITERATIONS):
        provider.rate_limiter.record()
        resp = await client.chat.completions.create(
            model=provider.model,
            messages=messages,
            tools=TOOL_SCHEMAS,
            temperature=0.0,
            max_tokens=2048,
            **extra,
        )
        choice = resp.choices[0]

        if choice.finish_reason == "tool_calls" or choice.message.tool_calls:
            messages.append(choice.message.model_dump(exclude_none=True))
            for tc in choice.message.tool_calls:
                args = json.loads(tc.function.arguments)
                log.info("Tool call: %s(%s)", tc.function.name, list(args.keys()))
                result = dispatch_tool(tc.function.name, args)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result, default=str),
                })
        else:
            text = choice.message.content or ""
            return _parse_agent_output(text)

    return _parse_agent_output("Agent reached max iterations without completing.")


def _parse_agent_output(text: str) -> dict:
    # ponytail: try to parse JSON from agent, fall back to wrapping text
    try:
        data = json.loads(text)
        if "results" in data:
            data.setdefault("meta", {})["mode"] = "agent"
            return enforce_guardrails(data)
    except (json.JSONDecodeError, TypeError):
        pass

    return enforce_guardrails({
        "results": [],
        "summary": {"agent_response": text},
        "meta": {"mode": "agent", "raw": True},
    })
