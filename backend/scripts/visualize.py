import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pyvis.network import Network

from app.graph.loader import load_all_rules
from app.graph.store import graph_store

COLORS = {
    "cash": "#f59e0b",
    "nutrition": "#10b981",
    "health": "#3b82f6",
    "energy": "#8b5cf6",
    "tax_credit": "#ef4444",
    "housing": "#6366f1",
    "education": "#14b8a6",
}

load_all_rules()

net = Network(directed=True, height="700px", width="100%")
net.barnes_hut(gravity=-3000, spring_length=150)

for p in graph_store.all_programs():
    size = 25 if p.get("is_hub") else 15
    net.add_node(
        p["id"],
        label=p.get("name", p["id"]),
        color=COLORS.get(p.get("category", ""), "#999"),
        size=size,
    )

for e in graph_store.all_edges():
    dashes = "streamlines" in e["relation"]
    net.add_edge(
        e["source"],
        e["target"],
        title=e["relation"],
        dashes=dashes,
        arrows="to",
    )

net.show("graph.html", notebook=False)
print("Generated graph.html")
