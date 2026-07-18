"""Graph store abstraction. Engine/agent import only this module, never networkx/neo4j directly."""

from __future__ import annotations

from typing import Any, Protocol


class GraphStore(Protocol):
    """Minimal interface — add methods as the engine/queries need them."""

    def add_program(self, program_id: str, **attrs: Any) -> None: ...
    def add_condition(self, condition_id: str, **attrs: Any) -> None: ...
    def add_edge(self, source: str, target: str, relation: str, **attrs: Any) -> None: ...
    def get_program(self, program_id: str) -> dict | None: ...
    def get_conditions(self, program_id: str) -> list[dict]: ...
    def get_categorical_sources(self, program_id: str) -> list[dict]: ...
    def get_streamline_sources(self, program_id: str) -> list[dict]: ...
    def expand_categorical(self, program_id: str, max_hops: int = 2) -> tuple[list[dict], list[dict]]: ...
    def all_programs(self) -> list[dict]: ...
    def all_edges(self) -> list[dict]: ...
    def program_count(self) -> int: ...


# ---------------------------------------------------------------------------
# NetworkX implementation (zero-infra default)
# ---------------------------------------------------------------------------
import networkx as nx


class NetworkXStore:
    def __init__(self) -> None:
        self._g = nx.DiGraph()

    def add_program(self, program_id: str, **attrs: Any) -> None:
        self._g.add_node(program_id, node_type="program", **attrs)

    def add_condition(self, condition_id: str, **attrs: Any) -> None:
        self._g.add_node(condition_id, node_type="condition", **attrs)

    def add_edge(self, source: str, target: str, relation: str, **attrs: Any) -> None:
        self._g.add_edge(source, target, relation=relation, **attrs)

    def get_program(self, program_id: str) -> dict | None:
        data = self._g.nodes.get(program_id)
        if data and data.get("node_type") == "program":
            return {"id": program_id, **data}
        return None

    def get_conditions(self, program_id: str) -> list[dict]:
        """Return all Condition nodes linked by a REQUIRES edge from this program."""
        out: list[dict] = []
        for _, target, edge in self._g.out_edges(program_id, data=True):
            if edge.get("relation") == "REQUIRES":
                node = self._g.nodes[target]
                out.append({"id": target, **node, "logic_group": edge.get("logic_group")})
        return out

    def get_categorical_sources(self, program_id: str) -> list[dict]:
        """Programs that CATEGORICALLY_QUALIFIES into this one."""
        out: list[dict] = []
        for source, _, edge in self._g.in_edges(program_id, data=True):
            if edge.get("relation") == "CATEGORICALLY_QUALIFIES":
                out.append({"source_program": source, **edge})
        return out

    def get_streamline_sources(self, program_id: str) -> list[dict]:
        """Programs that STREAMLINES into this one (with satisfies list)."""
        out: list[dict] = []
        for source, _, edge in self._g.in_edges(program_id, data=True):
            if edge.get("relation") == "STREAMLINES":
                out.append({"source_program": source, **edge})
        return out

    def expand_categorical(self, program_id: str, max_hops: int = 2) -> tuple[list[dict], list[dict]]:
        """BFS over CATEGORICALLY_QUALIFIES/STREAMLINES edges up to max_hops.
        Returns (nodes, edges) for the unlock tree."""
        nodes: list[dict] = []
        edges: list[dict] = []
        visited: set[str] = {program_id}
        frontier = [(program_id, 0)]

        root = self.get_program(program_id)
        if root:
            nodes.append({**root, "hop": 0, "relation_in": None})

        while frontier:
            current, hop = frontier.pop(0)
            if hop >= max_hops:
                continue
            for _, target, edge in self._g.out_edges(current, data=True):
                rel = edge.get("relation", "")
                if rel not in ("CATEGORICALLY_QUALIFIES", "STREAMLINES"):
                    continue
                if target in visited:
                    continue
                visited.add(target)
                target_data = self.get_program(target)
                if not target_data:
                    continue
                nodes.append({**target_data, "hop": hop + 1, "relation_in": rel.lower()})
                edges.append({
                    "source": current,
                    "target": target,
                    "relation": rel.lower(),
                    "satisfies": edge.get("satisfies"),
                })
                frontier.append((target, hop + 1))

        return nodes, edges

    def all_programs(self) -> list[dict]:
        return [
            {"id": nid, **data}
            for nid, data in self._g.nodes(data=True)
            if data.get("node_type") == "program"
        ]

    def all_edges(self) -> list[dict]:
        return [
            {"source": u, "target": v, **data}
            for u, v, data in self._g.edges(data=True)
            if data.get("relation") in ("CATEGORICALLY_QUALIFIES", "STREAMLINES")
        ]

    def program_count(self) -> int:
        return sum(1 for _, d in self._g.nodes(data=True) if d.get("node_type") == "program")


# ---------------------------------------------------------------------------
# Singleton — swap implementation here when Neo4j is ready
# ---------------------------------------------------------------------------
graph_store: GraphStore = NetworkXStore()
