# Unclaimed - Backend

AI agent that finds unclaimed government benefits via knowledge-graph reasoning. Models eligibility as a graph and reasons over it with multi-hop categorical logic ("if I enroll in SSI, what else unlocks?").

## Quick Start

```bash
# Install dependencies
uv sync

# Copy env template and fill in your LLM provider keys
cp .env.example .env

# Run the server
make run
# or: uv run uvicorn app.main:app --reload

# Verify
curl http://localhost:8000/health
```

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness check |
| POST | `/screen` | Situation → ranked eligibility results |
| POST | `/unlock` | "If I enroll in X, what unlocks?" cascade |
| GET | `/graph` | Program graph for visualization |
| GET | `/programs` | Program catalog |

## Make Targets

```
make sync   # install deps
make run    # dev server with reload
make test   # pytest
make graph  # interactive graph visualization (graph.html)
make clean  # remove caches
```

## Tech Stack

| Concern | Choice |
|---------|--------|
| Language | Python 3.11+ |
| Package manager | uv |
| API | FastAPI + Pydantic |
| Graph store | NetworkX |
| LLM | OpenAI-compatible (Groq, Together, Gemini, Ollama) |
| Rules format | YAML (one file per program) |
| Tests | pytest |

## How the Engine Works

```
Profile in
    |
    v
1. Auto-qualify check
   Enrolled in SSI? -> automatically eligible for Medicaid, SNAP, Lifeline... (skip income checks)
    |
    v
2. Partial credit from other programs
   Enrolled in SNAP? -> satisfies WIC's income test (but not its other conditions)
    |
    v
3. Evaluate remaining conditions
   Same logic_group = OR (any passes), groups AND'd together
   verifiable:false -> "uncertain" (needs agency verification)
    |
    v
4. Verdict
   Hard gate failed -> ineligible
   Unverifiable remaining -> uncertain
   All passed -> likely_eligible
```

No LLM involved. The graph is the source of truth.

# Knowledge Graph

![Knowledge Graph](media/graph.png)