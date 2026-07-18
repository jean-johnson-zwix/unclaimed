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
