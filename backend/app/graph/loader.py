from __future__ import annotations

from pathlib import Path

import yaml

from app.graph.store import graph_store

RULES_DIR = Path(__file__).resolve().parent.parent.parent / "rules"


class RuleLoadError(Exception):
    pass


def load_all_rules(rules_dir: Path = RULES_DIR) -> None:
    yaml_files = sorted(rules_dir.glob("*.yaml"))
    if not yaml_files:
        raise RuleLoadError(f"No YAML files found in {rules_dir}")
    for path in yaml_files:
        _load_program(path)


def _load_program(path: Path) -> None:
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as e:
        raise RuleLoadError(f"Malformed YAML in {path.name}: {e}") from e

    if not isinstance(raw, dict):
        raise RuleLoadError(f"{path.name}: expected a mapping at top level")

    program_id = raw.get("id")
    if not program_id:
        raise RuleLoadError(f"{path.name}: missing required field 'id'")

    graph_store.add_program(
        program_id,
        name=raw.get("name", program_id),
        agency=raw.get("agency", ""),
        category=raw.get("category", ""),
        jurisdiction=raw.get("jurisdiction", ["federal"]),
        is_hub=raw.get("is_hub", False),
        description=raw.get("description", ""),
        apply_url=raw.get("apply_url", ""),
        effective_date=raw.get("effective_date", ""),
    )

    for cond in raw.get("conditions", []):
        cond_id = cond.get("id")
        if not cond_id:
            raise RuleLoadError(f"{path.name}: condition missing 'id'")
        graph_store.add_condition(
            cond_id,
            type=cond.get("type", ""),
            measure=cond.get("measure", ""),
            operator=cond.get("operator", ""),
            value=cond.get("value"),
            unit=cond.get("unit", ""),
            hard_gate=cond.get("hard_gate", False),
            verifiable=cond.get("verifiable", True),
            description=cond.get("description", ""),
            label=cond.get("label", ""),
        )
        graph_store.add_edge(
            program_id,
            cond_id,
            "REQUIRES",
            logic_group=cond.get("logic_group"),
        )

    for cat_edge in raw.get("categorically_qualifies", []):
        target = cat_edge if isinstance(cat_edge, str) else cat_edge.get("target")
        graph_store.add_edge(program_id, target, "CATEGORICALLY_QUALIFIES", mode="full")

    for stream in raw.get("streamlined_by", []):
        source = stream.get("from")
        satisfies = stream.get("satisfies", [])
        if source:
            graph_store.add_edge(source, program_id, "STREAMLINES", satisfies=satisfies)
