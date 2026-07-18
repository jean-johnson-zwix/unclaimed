from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

FORBIDDEN = [
    r"\byou qualify\b",
    r"\byou are eligible\b",
    r"\byou're eligible\b",
    r"\bguaranteed\b",
    r"\bdefinitely eligible\b",
    r"\bwill receive\b",
    r"\bshould disenroll\b",
    r"\bstop receiving\b",
]

_FORBIDDEN_RE = re.compile("|".join(FORBIDDEN), re.IGNORECASE)


def scan_forbidden(output: dict) -> list[str]:
    """Scan serialized output for forbidden phrases. Returns list of violations."""
    text = json.dumps(output)
    return _FORBIDDEN_RE.findall(text)


def enforce_guardrails(output: dict) -> dict:
    """Log warning if forbidden phrases found. Returns output unchanged
    (the engine already uses safe language; this is a safety net)."""
    violations = scan_forbidden(output)
    if violations:
        logger.warning("Guardrail violation detected: %s", violations)
    return output
