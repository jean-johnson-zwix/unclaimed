from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.graph.loader import load_all_rules
from app.graph.store import graph_store


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
