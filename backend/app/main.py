from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.agent.pipeline import run_pipeline, run_unlock
from app.graph.loader import load_all_rules
from app.graph.store import graph_store
from app.models import Profile


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_all_rules()
    yield


app = FastAPI(title="Unclaimed", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "programs_loaded": graph_store.program_count(),
        "fpl_year": 2026,
    }


class ScreenRequest(BaseModel):
    profile: Profile


class UnlockRequest(BaseModel):
    program_id: str


@app.post("/screen")
def screen(req: ScreenRequest):
    return run_pipeline(req.profile)


@app.post("/unlock")
def unlock(req: UnlockRequest):
    result = run_unlock(req.program_id)
    if not result:
        raise HTTPException(status_code=404, detail={"error": {"code": "unknown_program", "message": f"Program '{req.program_id}' not found"}})
    return result


@app.get("/graph")
def graph(include: str = "programs", category: str | None = None):
    programs = graph_store.all_programs()
    if category:
        programs = [p for p in programs if p.get("category") == category]
    prog_ids = {p["id"] for p in programs}

    nodes = [
        {"id": p["id"], "name": p.get("name", ""), "category": p.get("category", ""), "is_hub": p.get("is_hub", False)}
        for p in programs
    ]

    edges = [
        {"source": e["source"], "target": e["target"], "relation": e["relation"].lower(), "satisfies": e.get("satisfies")}
        for e in graph_store.all_edges()
        if e["source"] in prog_ids and e["target"] in prog_ids
    ]

    return {"nodes": nodes, "edges": edges, "meta": {"node_count": len(nodes), "edge_count": len(edges), "include": include}}


@app.get("/programs")
def programs(category: str | None = None, jurisdiction: str | None = None, hub: bool | None = None):
    result = graph_store.all_programs()
    if category:
        result = [p for p in result if p.get("category") == category]
    if jurisdiction:
        result = [p for p in result if jurisdiction in p.get("jurisdiction", [])]
    if hub is not None:
        result = [p for p in result if p.get("is_hub", False) == hub]

    out = [
        {
            "id": p["id"],
            "name": p.get("name", ""),
            "agency": p.get("agency", ""),
            "category": p.get("category", ""),
            "jurisdiction": p.get("jurisdiction", []),
            "is_hub": p.get("is_hub", False),
            "description": p.get("description", ""),
            "apply_url": p.get("apply_url", ""),
            "effective_date": p.get("effective_date", ""),
        }
        for p in result
    ]
    return {"count": len(out), "programs": out}
