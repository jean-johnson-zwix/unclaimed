"""Quick check: which LLM API keys still work."""

import asyncio
import os
import sys

from openai import AsyncOpenAI

PROVIDERS = {
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "key_env": "GROQ_API_KEY",
        "model": "llama-3.1-8b-instant",
    },
    "cerebras": {
        "base_url": "https://api.cerebras.ai/v1",
        "key_env": "CEREBRAS_API_KEY",
        "model": "gemma-4-31b",
    },
    "sambanova": {
        "base_url": "https://api.sambanova.ai/v1",
        "key_env": "SAMBANOVA_API_KEY",
        "model": "Meta-Llama-3.3-70B-Instruct",
    },
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "key_env": "GEMINI_API_KEY",
        "model": "gemini-2.5-flash-lite",
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "key_env": "OPENROUTER_API_KEY",
        "model": "tencent/hy3:free",
    },
}


async def check(name: str, cfg: dict) -> None:
    key = os.getenv(cfg["key_env"], "")
    if not key:
        print(f"  {name:12s}  SKIP  (no key)")
        return
    client = AsyncOpenAI(base_url=cfg["base_url"], api_key=key)
    try:
        resp = await client.chat.completions.create(
            model=cfg["model"],
            messages=[{"role": "user", "content": "Say OK"}],
            max_tokens=4,
            temperature=0,
        )
        text = (resp.choices[0].message.content or "").strip()
        print(f"  {name:12s}  OK    -> {text!r}")
    except Exception as e:
        msg = str(e)[:80]
        print(f"  {name:12s}  FAIL  {msg}")


async def main():
    from dotenv import load_dotenv
    load_dotenv()
    print("Checking LLM API keys...\n")
    await asyncio.gather(*(check(n, c) for n, c in PROVIDERS.items()))
    print()


if __name__ == "__main__":
    asyncio.run(main())
