# API_SPEC.md — Unclaimed Backend

**Contract for the frontend.** Field names are `snake_case` (Pydantic backend). All request/response bodies are `application/json`. This spec is the source of truth for the frontend/backend boundary — if the implementation and this doc disagree, that's a bug to reconcile, not a silent drift.

- **Base URL (local dev):** `http://localhost:8000`
- **CORS:** backend allows the frontend origin (configure in dev; `*` is fine for the hackathon).
- **Auth:** none (hackathon).
- **Versioning:** none; bare paths.

**Endpoints:**

| Method | Path | Purpose | Priority |
|---|---|---|---|
| GET | `/health` | Liveness check | MVP |
| POST | `/screen` | Situation → ranked, cited eligibility results | MVP |
| POST | `/unlock` | "If I enroll in X, what unlocks?" — the cascade | MVP |
| GET | `/graph` | Full program graph for visualization | CORE |
| GET | `/programs` | Program catalog (browse/filter) | MVP |

---

## Shared object schemas

These objects appear across multiple endpoints. Defined once here; referenced below.

### `Profile` (input)
The household situation. Sent to `/screen` either directly (`profile`) or produced by the backend from freeform `text`.

| Field | Type | Req | Notes |
|---|---|---|---|
| `household_size` | int | ✔ | ≥1 |
| `monthly_income` | number | ✔ | gross, USD/month |
| `state` | string | – | 2-letter; default `"AZ"` |
| `age` | int \| null | – | applicant age |
| `categories` | string[] | – | status flags; see **Enum: categories** |
| `enrolled_in` | string[] | – | program ids already receiving; drives categorical logic; see **Enum: program ids** |
| `assets` | number \| null | – | total countable assets, USD |
| `immigration_status` | string \| null | – | free string; most immigration logic is agency-verify |

### `ConditionResult` (output)
One rule condition, evaluated.

| Field | Type | Notes |
|---|---|---|
| `condition_id` | string | e.g. `"snap_gross_income"` |
| `label` | string | human-readable condition name |
| `passed` | bool \| null | `null` = uncertain / agency-verify |
| `detail` | string | e.g. `"Income $2,000/mo ≤ 185% FPL ($2,893/mo)"` |
| `source_url` | string \| null | citation/source for this condition |

### `EligibilityResult` (output)
One program's verdict for the profile. **Pre-sorted** by the backend (see Ranking).

| Field | Type | Notes |
|---|---|---|
| `program_id` | string | `"snap"` |
| `program_name` | string | display name, `"SNAP (Nutrition Assistance)"` |
| `category` | string | `"nutrition"`, `"health"`, `"cash"`, `"tax_credit"`, `"housing"`, `"energy"`, `"education"` |
| `verdict` | string | `"likely_eligible"` \| `"uncertain"` \| `"ineligible"` |
| `matched` | ConditionResult[] | conditions that passed (the provenance) |
| `failed` | ConditionResult[] | conditions that failed (present on `ineligible`) |
| `needs_verification` | ConditionResult[] | agency-verify leaves (present on `uncertain`) |
| `unlocks` | Unlock[] | downstream programs this one opens; see `Unlock`. May be `[]` |
| `estimated_benefit` | object \| null | STRETCH; `null` until PolicyEngine wired. `{ "annual": 7200, "unit": "USD", "note": "estimate" }` |
| `apply_url` | string | where to apply |
| `effective_date` | string | `"2026-01"` — rule vintage |

### `Unlock` (output)
A program made reachable by enrolling in another.

| Field | Type | Notes |
|---|---|---|
| `program_id` | string | |
| `program_name` | string | |
| `relation` | string | `"categorically_qualifies"` (full) \| `"streamlines"` (partial) |
| `hop` | int | 1 = direct, 2 = second-order |
| `satisfies` | string[] \| null | for `streamlines`: which conditions it covers (else `null`) |

### `ProgramSummary` (output)
Catalog entry.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `name` | string | |
| `agency` | string | |
| `category` | string | |
| `jurisdiction` | string[] | `["federal"]`, `["federal","AZ"]`, `["AZ"]` |
| `is_hub` | bool | one of the 4 hubs |
| `description` | string | one-liner |
| `conditions_summary` | string | plain-language eligibility gist |
| `apply_url` | string | |
| `effective_date` | string | |

### `Disclaimers` (output)
Present on `/screen` and `/unlock`. Render these in the UI.
```json
{
  "not_a_determination": "This is a preliminary screening, not an official eligibility determination. Verify with each agency.",
  "immigration": "Immigration-related eligibility is complex and changing (Nov 2025 DHS public-charge proposal). Consult an immigration attorney; do not disenroll from benefits based on this tool.",
  "general": "Estimates are based on the information provided and rules effective as of the dates shown."
}
```

### `ErrorResponse` (output)
All 4xx/5xx use this shape.
```json
{ "error": { "code": "invalid_profile", "message": "household_size must be >= 1", "details": {} } }
```
Codes: `invalid_profile`, `unparseable_text`, `unknown_program`, `internal_error`.

---

## GET `/health`
**Response 200**
```json
{ "status": "ok", "programs_loaded": 20, "fpl_year": 2026 }
```

---

## POST `/screen`
The main flow. **Primary path: a structured `profile`** (produced by the intake form — see `INTAKE.md`). A freeform `text` field is an **optional** quick-start that the backend parses into a profile (depends on the LLM intake parser, a stretch item). Send exactly one; prefer `profile`.

### Request — structured
```json
{
  "profile": {
    "household_size": 3,
    "monthly_income": 2000,
    "state": "AZ",
    "age": 31,
    "categories": ["has_child_under_5", "pregnant"],
    "enrolled_in": ["ssi"],
    "assets": 500,
    "immigration_status": null
  }
}
```

### Request — freeform (OPTIONAL quick-start; backend parses → Profile; STRETCH FR-7.1)
```json
{ "text": "single mom in Phoenix, two kids, makes about $2,000 a month, I get SSI" }
```

### Response 200
```json
{
  "resolved_profile": {
    "household_size": 3,
    "monthly_income": 2000,
    "state": "AZ",
    "age": 31,
    "categories": ["has_child_under_5", "pregnant"],
    "enrolled_in": ["ssi"],
    "assets": 500,
    "immigration_status": null
  },
  "results": [
    {
      "program_id": "medicaid",
      "program_name": "AHCCCS (Arizona Medicaid)",
      "category": "health",
      "verdict": "likely_eligible",
      "matched": [
        { "condition_id": "categorical:ssi", "label": "Auto-qualifies via SSI", "passed": true,
          "detail": "SSI recipients are automatically enrolled in AHCCCS", "source_url": "https://www.azahcccs.gov/Members/" }
      ],
      "failed": [],
      "needs_verification": [],
      "unlocks": [
        { "program_id": "extra_help", "program_name": "Medicare Extra Help", "relation": "categorically_qualifies", "hop": 1, "satisfies": null }
      ],
      "estimated_benefit": null,
      "apply_url": "https://www.healthearizonaplus.gov",
      "effective_date": "2026-01"
    },
    {
      "program_id": "snap",
      "program_name": "SNAP (Nutrition Assistance)",
      "category": "nutrition",
      "verdict": "likely_eligible",
      "matched": [
        { "condition_id": "categorical:ssi", "label": "Auto-qualifies via SSI", "passed": true,
          "detail": "SSI enrollment categorically qualifies for SNAP", "source_url": "https://www.fns.usda.gov/snap/eligibility" }
      ],
      "failed": [],
      "needs_verification": [],
      "unlocks": [
        { "program_id": "wic", "program_name": "WIC", "relation": "streamlines", "hop": 1, "satisfies": ["wic_income"] },
        { "program_id": "school_meals", "program_name": "Free/Reduced School Meals", "relation": "categorically_qualifies", "hop": 1, "satisfies": null },
        { "program_id": "lifeline", "program_name": "Lifeline", "relation": "categorically_qualifies", "hop": 1, "satisfies": null }
      ],
      "estimated_benefit": null,
      "apply_url": "https://www.healthearizonaplus.gov",
      "effective_date": "2026-01"
    },
    {
      "program_id": "wic",
      "program_name": "WIC",
      "category": "nutrition",
      "verdict": "uncertain",
      "matched": [
        { "condition_id": "wic_income", "label": "Income test", "passed": true,
          "detail": "Income test satisfied adjunctively via SNAP/SSI", "source_url": "https://www.fns.usda.gov/wic" },
        { "condition_id": "wic_category", "label": "Category (pregnant/child<5)", "passed": true,
          "detail": "Household includes a pregnant member and a child under 5", "source_url": "https://www.fns.usda.gov/wic" }
      ],
      "failed": [],
      "needs_verification": [
        { "condition_id": "wic_nutritional_risk", "label": "Nutritional risk", "passed": null,
          "detail": "Must be determined by a health professional at a WIC clinic", "source_url": "https://www.fns.usda.gov/wic" }
      ],
      "unlocks": [],
      "estimated_benefit": null,
      "apply_url": "https://www.fns.usda.gov/wic",
      "effective_date": "2026-01"
    }
  ],
  "summary": {
    "likely_eligible": 2,
    "uncertain": 1,
    "programs_checked": 8,
    "estimated_total_annual": null
  },
  "disclaimers": {
    "not_a_determination": "This is a preliminary screening, not an official eligibility determination. Verify with each agency.",
    "immigration": "Immigration-related eligibility is complex and changing (Nov 2025 DHS public-charge proposal). Consult an immigration attorney; do not disenroll from benefits based on this tool.",
    "general": "Estimates are based on the information provided and rules effective as of the dates shown."
  },
  "meta": { "fpl_year": 2026, "generated_at": "2026-07-17T00:00:00Z", "mode": "pipeline" }
}
```

**Notes for frontend:**
- `results` is **pre-sorted**: `likely_eligible` first, then `uncertain`; `ineligible` programs are omitted by default (they were checked but aren't shown). Within a group, sorted by `estimated_benefit.annual` desc when available, else program priority.
- `matched` is your **"why" panel** — render these as the citation trail. Each has a `source_url`.
- `needs_verification` is the **"almost — do this" panel** for `uncertain` results.
- `unlocks` lets you show "enrolling in this opens N more" inline; the full tree is `/unlock`.
- `meta.mode` is `"pipeline"` or `"agent"` — informational; behavior/shape is identical.

**Errors:** `400 invalid_profile` (bad/missing fields), `400 unparseable_text` (freeform couldn't resolve), `422` (Pydantic validation).

---

## POST `/unlock`
The cascade. Returns a flat node/edge graph (ready for force-graph / d3) rooted at one program. This powers the demo money-shot.

### Request
```json
{ "program_id": "ssi" }
```

### Response 200
```json
{
  "root": "ssi",
  "root_name": "SSI",
  "nodes": [
    { "id": "ssi", "name": "SSI", "category": "cash", "hop": 0, "relation_in": null },
    { "id": "medicaid", "name": "AHCCCS (Arizona Medicaid)", "category": "health", "hop": 1, "relation_in": "categorically_qualifies" },
    { "id": "snap", "name": "SNAP (Nutrition Assistance)", "category": "nutrition", "hop": 1, "relation_in": "categorically_qualifies" },
    { "id": "extra_help", "name": "Medicare Extra Help", "category": "health", "hop": 1, "relation_in": "categorically_qualifies" },
    { "id": "weatherization", "name": "Weatherization Assistance", "category": "energy", "hop": 1, "relation_in": "categorically_qualifies" },
    { "id": "lifeline", "name": "Lifeline", "category": "energy", "hop": 1, "relation_in": "categorically_qualifies" },
    { "id": "wic", "name": "WIC", "category": "nutrition", "hop": 2, "relation_in": "streamlines" },
    { "id": "school_meals", "name": "Free/Reduced School Meals", "category": "nutrition", "hop": 2, "relation_in": "categorically_qualifies" },
    { "id": "summer_ebt", "name": "Summer EBT", "category": "nutrition", "hop": 3, "relation_in": "categorically_qualifies" }
  ],
  "edges": [
    { "source": "ssi", "target": "medicaid", "relation": "categorically_qualifies", "satisfies": null },
    { "source": "ssi", "target": "snap", "relation": "categorically_qualifies", "satisfies": null },
    { "source": "ssi", "target": "extra_help", "relation": "categorically_qualifies", "satisfies": null },
    { "source": "ssi", "target": "weatherization", "relation": "categorically_qualifies", "satisfies": null },
    { "source": "ssi", "target": "lifeline", "relation": "categorically_qualifies", "satisfies": null },
    { "source": "snap", "target": "wic", "relation": "streamlines", "satisfies": ["wic_income"] },
    { "source": "snap", "target": "school_meals", "relation": "categorically_qualifies", "satisfies": null },
    { "source": "school_meals", "target": "summer_ebt", "relation": "categorically_qualifies", "satisfies": null }
  ],
  "disclaimers": {
    "not_a_determination": "This is a preliminary screening, not an official eligibility determination. Verify with each agency.",
    "general": "Categorical links reflect rules effective as of the dates shown."
  }
}
```

**Notes for frontend:**
- `nodes[].hop` gives you concentric rings / left-to-right layering. `relation_in` = how this node was reached (color/style the incoming edge).
- Two edge relations to style distinctly: `categorically_qualifies` (full, solid) vs `streamlines` (partial, dashed) — the `satisfies` list explains the partial link on hover.
- Traversal depth is ≤2 hops from the graph, but second-order nodes (e.g. `summer_ebt` via `school_meals`) can surface as hop 3 — don't assume a max.

**Errors:** `404 unknown_program`.

---

## GET `/graph`
The full program-level graph for the explore/visualize view.

### Query params
| Param | Type | Default | Notes |
|---|---|---|---|
| `include` | string | `programs` | `programs` = program nodes + program→program edges only. `conditions` = also include Condition nodes and REQUIRES/EXCLUDES edges (noisier). |
| `category` | string | – | filter program nodes by category |

### Response 200 (`include=programs`)
```json
{
  "nodes": [
    { "id": "ssi", "name": "SSI", "category": "cash", "is_hub": true },
    { "id": "snap", "name": "SNAP (Nutrition Assistance)", "category": "nutrition", "is_hub": true },
    { "id": "medicaid", "name": "AHCCCS (Arizona Medicaid)", "category": "health", "is_hub": true },
    { "id": "tanf", "name": "TANF (Cash Assistance)", "category": "cash", "is_hub": true },
    { "id": "wic", "name": "WIC", "category": "nutrition", "is_hub": false }
  ],
  "edges": [
    { "source": "ssi", "target": "medicaid", "relation": "categorically_qualifies", "satisfies": null },
    { "source": "snap", "target": "wic", "relation": "streamlines", "satisfies": ["wic_income"] }
  ],
  "meta": { "node_count": 20, "edge_count": 18, "include": "programs" }
}
```

**Notes for frontend:** default (`programs`) is the clean, demo-friendly view — ~20 nodes, ~18 categorical edges, hubs flagged for emphasis. Only request `conditions` if you're building a deep-inspect view; it adds many nodes.

---

## GET `/programs`
Catalog for browse/filter/search UI.

### Query params
| Param | Type | Notes |
|---|---|---|
| `category` | string | filter by category |
| `jurisdiction` | string | `federal` \| `AZ` |
| `hub` | bool | only hub programs |

### Response 200
```json
{
  "count": 20,
  "programs": [
    {
      "id": "snap",
      "name": "SNAP (Nutrition Assistance)",
      "agency": "USDA / AZ DES",
      "category": "nutrition",
      "jurisdiction": ["federal", "AZ"],
      "is_hub": true,
      "description": "Monthly food benefits on an EBT card.",
      "conditions_summary": "Gross income ≤185% FPL (AZ), Arizona residency. Auto-qualifies via SSI or TANF.",
      "apply_url": "https://www.healthearizonaplus.gov",
      "effective_date": "2026-01"
    }
  ]
}
```

---

## Appendix — Enumerations (build intake forms from these)

### Enum: `verdict`
`likely_eligible` · `uncertain` · `ineligible`

### Enum: edge `relation`
`categorically_qualifies` (full auto-qualify) · `streamlines` (partial — satisfies named conditions only)

### Enum: `category` (program categories)
`nutrition` · `health` · `cash` · `tax_credit` · `housing` · `energy` · `education`

### Enum: `categories` (household status flags — for the intake form checkboxes)
`pregnant` · `postpartum` · `infant` · `has_child_under_5` · `has_child` · `senior_65plus` · `disabled` · `blind` · `veteran` · `student` · `homeless` · `foster_child`
> Extensible — coordinate before adding new ones, since conditions reference these strings.

### Enum: program ids (`enrolled_in` options + valid `/unlock` and `/programs` ids)
MVP ~20: `snap` · `tanf` · `ssi` · `medicaid` · `wic` · `lifeline` · `liheap` · `school_meals` · `head_start` · `section_8` · `aca_ptc` · `eitc` · `ctc` · `savers_credit` · `msp` · `extra_help` · `weatherization` · `summer_ebt` · `az_140ptc` · `az_140et`
> `medicaid` is the id; **AHCCCS** is its Arizona display name. `enrolled_in` most commonly uses the hubs (`snap`, `tanf`, `ssi`, `medicaid`), which drive the categorical logic.

### Enum: `state`
2-letter USPS codes. MVP is `AZ`; federal programs apply nationwide but AZ-specific thresholds assume `AZ`.

---

## Frozen vs. likely-to-change (so the frontend knows what's safe to build on)

- **Frozen (build against these now):** all endpoint paths, `Profile`, `EligibilityResult`, `Unlock`, `/screen` and `/unlock` response envelopes, the enums.
- **May still change:** `estimated_benefit` (null until PolicyEngine — stretch), `/graph?include=conditions` shape (deep-inspect view is CORE/stretch).
- **Decision locked:** the structured `profile` is the **primary** path and the guaranteed contract; build the intake form against it (see `INTAKE.md`). Freeform `text` is an optional demo garnish (stretch) — the frontend must be fully functional with the text box absent.