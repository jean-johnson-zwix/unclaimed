from __future__ import annotations

import json
import logging

from app.llm import get_providers
from app.models import Profile

from openai import AsyncOpenAI

log = logging.getLogger(__name__)

INTAKE_PROMPT = """\
Extract a structured profile from the user's natural language description. Return ONLY valid JSON matching this schema:
{"household_size": int, "monthly_income": float, "state": str (2-letter), "age": int|null, "categories": list[str], "enrolled_in": list[str], "assets": float|null, "immigration_status": str|null}

Valid categories: senior_65plus, pregnant, postpartum, has_child_under_5, has_child, infant, disabled, veteran, student, homeless, foster_child
Valid enrolled_in: ssi, snap, tanf, medicaid
State default: "AZ". Convert weekly income to monthly (*4.33), yearly to monthly (/12).
If a field cannot be determined, use the default (household_size=1, monthly_income=0, state="AZ", others null/empty).
Return ONLY the JSON object, no markdown, no explanation."""


async def parse_intake(text: str) -> Profile | None:
    providers = get_providers()
    if not providers:
        return None

    messages = [
        {"role": "system", "content": INTAKE_PROMPT},
        {"role": "user", "content": text},
    ]

    for p in providers:
        if not p.rate_limiter.is_allowed():
            continue
        try:
            client = AsyncOpenAI(base_url=p.base_url, api_key=p.api_key)
            extra = {}
            if p.extra_headers:
                extra["extra_headers"] = p.extra_headers
            p.rate_limiter.record()
            log.warning("[intake] provider=%s | model=%s", p.name, p.model)
            resp = await client.chat.completions.create(
                model=p.model,
                messages=messages,
                temperature=0.0,
                max_tokens=256,
                **extra,
            )
            raw = resp.choices[0].message.content or ""
            raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            data = json.loads(raw)
            profile = Profile(**data)
            log.warning("[intake] parsed: %s", profile.model_dump_json())
            return profile
        except Exception as e:
            log.warning("[intake] failed (%s): %s", p.name, e)

    return None
