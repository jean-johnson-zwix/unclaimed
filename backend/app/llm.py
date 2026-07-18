from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

log = logging.getLogger(__name__)

REGISTRY: dict[str, dict] = {
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "key_env": "GROQ_API_KEY",
        "model": "llama-3.1-8b-instant",
        "rpm": 14400,
        "tpm": 6000,
    },
    "cerebras": {
        "base_url": "https://api.cerebras.ai/v1",
        "key_env": "CEREBRAS_API_KEY",
        "model": "gemma-4-31b",
        "rpm": 5,
        "tpm": 30000,
    },
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "key_env": "GEMINI_API_KEY",
        "model": "gemini-2.5-flash-lite",
        "rpm": 30,
        "tpm": 1000000,
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "key_env": "OPENROUTER_API_KEY",
        "model": "tencent/hy3:free",
        "rpm": 20,
        "tpm": 200000,
        "extra_headers": {
            "X-OpenRouter-Title": "Unclaimed Benefits Screener",
        },
    },
    "sambanova": {
        "base_url": "https://api.sambanova.ai/v1",
        "key_env": "SAMBANOVA_API_KEY",
        "model": "Meta-Llama-3.3-70B-Instruct",
        "rpm": 10,
        "tpm": 100000,
    },
}

DEFAULT_CHAIN = "groq,cerebras,gemini,openrouter"


@dataclass
class RateLimiter:
    rpm: int
    _timestamps: list[float] = field(default_factory=list)

    def is_allowed(self) -> bool:
        now = time.monotonic()
        cutoff = now - 60
        self._timestamps = [t for t in self._timestamps if t > cutoff]
        return len(self._timestamps) < self.rpm

    def record(self) -> None:
        self._timestamps.append(time.monotonic())


@dataclass
class Provider:
    name: str
    base_url: str
    api_key: str
    model: str
    rate_limiter: RateLimiter
    extra_headers: dict[str, str] | None = None


def _load_providers() -> list[Provider]:
    chain = os.getenv("LLM_FALLBACK_CHAIN", DEFAULT_CHAIN)
    providers = []
    for name in chain.split(","):
        name = name.strip()
        entry = REGISTRY.get(name)
        if not entry:
            log.warning("Unknown provider in LLM_FALLBACK_CHAIN: %s", name)
            continue
        key = os.getenv(entry["key_env"], "")
        if not key:
            log.warning("No API key for %s (%s)", name, entry["key_env"])
            continue
        model = os.getenv(f"{name.upper()}_MODEL", entry["model"])
        rl = RateLimiter(rpm=entry.get("rpm", 30))
        providers.append(Provider(name, entry["base_url"], key, model, rl, entry.get("extra_headers")))
    return providers


_providers: list[Provider] | None = None


def get_providers() -> list[Provider]:
    global _providers
    if _providers is None:
        _providers = _load_providers()
    return _providers


def reload_providers() -> None:
    global _providers
    _providers = None


async def chat(
    messages: list[dict],
    *,
    temperature: float = 0.0,
    max_tokens: int = 1024,
    **kwargs,
) -> str:
    providers = get_providers()
    if not providers:
        raise RuntimeError("No LLM providers configured")

    last_err: Exception | None = None
    for p in providers:
        if not p.rate_limiter.is_allowed():
            log.info("Skipping %s: rate limit (%d rpm)", p.name, p.rate_limiter.rpm)
            continue
        client = AsyncOpenAI(base_url=p.base_url, api_key=p.api_key)
        try:
            extra = dict(kwargs)
            if p.extra_headers:
                extra["extra_headers"] = p.extra_headers
            resp = await client.chat.completions.create(
                model=p.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                **extra,
            )
            p.rate_limiter.record()
            return resp.choices[0].message.content or ""
        except Exception as e:
            p.rate_limiter.record()
            log.warning("Provider %s (%s) failed: %s", p.name, p.model, e)
            last_err = e
    raise RuntimeError(f"All {len(providers)} LLM providers failed") from last_err
