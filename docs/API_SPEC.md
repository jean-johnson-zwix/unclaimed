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
| POST | `/screen` | Situation -> ranked, cited eligibility results | MVP |
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
| `household_size` | int | Y | >=1 |
| `monthly_income` | number | Y | gross, USD/month |
| `state` | string | – | 2-letter; default `"AZ"`. Supported: AZ, CA, TX (federal programs apply to all) |
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
| `detail` | string | e.g. `"Income $2,000/mo <= 185% FPL ($2,893/mo)"` |
| `source_url` | string \| null | citation/source for this condition |

### `EligibilityResult` (output)
One program's verdict for the profile. **Pre-sorted** by the backend (see Ranking).

| Field | Type | Notes |
|---|---|---|
| `program_id` | string | `"snap"` |
| `program_name` | string | display name, `"SNAP (Nutrition Assistance)"` |
| `category` | string | `"nutrition"`, `"health"`, `"cash"`, `"tax_credit"`, `"housing"`, `"energy"`, `"education"`, `"telecom"`, `"cash_assistance"` |
| `verdict` | string | `"likely_eligible"` \| `"uncertain"` \| `"ineligible"` |
| `matched` | ConditionResult[] | conditions that passed (the provenance) |
| `failed` | ConditionResult[] | conditions that failed (present on `ineligible`) |
| `needs_verification` | ConditionResult[] | agency-verify leaves (present on `uncertain`) |
| `unlocks` | Unlock[] | downstream programs this one opens; see `Unlock`. May be `[]` |
| `estimated_benefit` | BenefitEstimate \| null | dollar estimate from static tables. `null` if no data for this program |
| `apply_url` | string | where to apply |
| `effective_date` | string | `"2026-01"` — rule vintage |

### `BenefitEstimate` (output)
Dollar estimate for a program given the profile's household size.

| Field | Type | Notes |
|---|---|---|
| `estimated_annual` | int | annual dollar value |
| `estimated_monthly` | int | monthly dollar value |
| `note` | string | e.g. `"average benefit estimate"`, `"per child, ~$7/day"` |
| `source` | string | `"CBPP/USDA/IRS published averages 2025-2026"` |

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
Catalog entry (from `/programs`).

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `name` | string | |
| `agency` | string | |
| `category` | string | |
| `jurisdiction` | string[] | `["federal"]`, `["federal","AZ"]`, `["AZ"]`, `["CA"]`, `["TX"]` |
| `is_hub` | bool | one of the 4 hubs |
| `description` | string | one-liner |
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
Codes: `invalid_profile`, `unparseable_text`, `unknown_program`, `intake_failed`, `missing_profile`, `internal_error`.

---

## GET `/health`
**Response 200**
```json
{ "status": "ok", "programs_loaded": 61, "fpl_year": 2026 }
```

---

## POST `/screen`
The main flow. **Primary path: a structured `profile`** (produced by the intake form — see `INTAKE.md`). A freeform `text` field is an **optional** quick-start that the backend parses into a profile via LLM. Send exactly one; prefer `profile`.

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
  },
  "mode": "pipeline"
}
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `profile` | Profile \| null | null | structured input (preferred) |
| `text` | string \| null | null | freeform input (LLM parses to Profile) |
| `mode` | string | `"pipeline"` | `"pipeline"` (deterministic, no LLM) or `"agent"` (LLM explanation, falls back to pipeline on failure) |

### Request — freeform (optional; backend LLM parses -> Profile)
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
        { "condition_id": "medicaid_income", "label": "Income at or below 138% FPL", "passed": true,
          "detail": "Income $2,000/mo <= 138% FPL ($2,549/mo for household of 3)", "source_url": "https://www.azahcccs.gov/Members/" }
      ],
      "failed": [],
      "needs_verification": [],
      "unlocks": [
        { "program_id": "extra_help", "program_name": "Medicare Extra Help", "relation": "categorically_qualifies", "hop": 1, "satisfies": null }
      ],
      "estimated_benefit": { "estimated_annual": 16000, "estimated_monthly": 1333, "note": "estimated value of coverage", "source": "CBPP/USDA/IRS published averages 2025-2026" },
      "apply_url": "https://www.healthearizonaplus.gov",
      "effective_date": "2026-01"
    },
    {
      "program_id": "snap",
      "program_name": "SNAP (Nutrition Assistance)",
      "category": "nutrition",
      "verdict": "likely_eligible",
      "matched": [
        { "condition_id": "snap_gross_income", "label": "Gross income at or below 185% FPL", "passed": true,
          "detail": "Income $2,000/mo <= 185% FPL ($2,893/mo for household of 3)", "source_url": "https://www.fns.usda.gov/snap/eligibility" }
      ],
      "failed": [],
      "needs_verification": [],
      "unlocks": [
        { "program_id": "school_meals", "program_name": "Free/Reduced School Meals", "relation": "categorically_qualifies", "hop": 1, "satisfies": null }
      ],
      "estimated_benefit": { "estimated_annual": 7392, "estimated_monthly": 616, "note": "average benefit estimate", "source": "CBPP/USDA/IRS published averages 2025-2026" },
      "apply_url": "https://www.healthearizonaplus.gov",
      "effective_date": "2026-01"
    }
  ],
  "summary": {
    "likely_eligible": 2,
    "uncertain": 0,
    "programs_checked": 14,
    "estimated_total_annual": 23392
  },
  "disclaimers": {
    "not_a_determination": "This is a preliminary screening, not an official eligibility determination. Verify with each agency.",
    "immigration": "Immigration-related eligibility is complex and changing (Nov 2025 DHS public-charge proposal). Consult an immigration attorney; do not disenroll from benefits based on this tool.",
    "general": "Estimates are based on the information provided and rules effective as of the dates shown."
  },
  "meta": { "fpl_year": 2026, "mode": "pipeline" }
}
```

**Notes for frontend:**
- `results` is **pre-sorted**: `likely_eligible` first, then `uncertain`; `ineligible` programs are omitted by default (they were checked but aren't shown). Within a group, sorted by number of unlocks desc.
- `matched` is your **"why" panel** — render these as the citation trail. Each has a `source_url`.
- `needs_verification` is the **"almost — do this" panel** for `uncertain` results.
- `unlocks` lets you show "enrolling in this opens N more" inline; the full tree is `/unlock`.
- `meta.mode` is `"pipeline"` or `"agent"` — informational; response shape is identical.
- `summary.estimated_total_annual` sums `estimated_benefit.estimated_annual` for all `likely_eligible` results. `null` if no estimates available.
- Agent mode (`mode: "agent"`) adds an `explanation` field (string) with LLM-generated hedged summary. Falls back to pipeline silently on LLM failure.

**Errors:** `422 missing_profile` (neither profile nor text), `422 intake_failed` (freeform text couldn't parse), `422` (Pydantic validation).

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
    { "id": "lifeline", "name": "Lifeline", "category": "telecom", "hop": 1, "relation_in": "categorically_qualifies" },
    { "id": "school_meals", "name": "Free/Reduced School Meals", "category": "nutrition", "hop": 2, "relation_in": "categorically_qualifies" }
  ],
  "edges": [
    { "source": "ssi", "target": "medicaid", "relation": "categorically_qualifies", "satisfies": null },
    { "source": "ssi", "target": "snap", "relation": "categorically_qualifies", "satisfies": null },
    { "source": "ssi", "target": "extra_help", "relation": "categorically_qualifies", "satisfies": null },
    { "source": "ssi", "target": "weatherization", "relation": "categorically_qualifies", "satisfies": null },
    { "source": "ssi", "target": "lifeline", "relation": "categorically_qualifies", "satisfies": null },
    { "source": "snap", "target": "school_meals", "relation": "categorically_qualifies", "satisfies": null }
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
- Traversal depth is <=2 hops from the graph, but second-order nodes can surface as hop 3 — don't assume a max.

**Errors:** `404 unknown_program`.

---

## GET `/graph`
The full program-level graph for the explore/visualize view.

### Query params
| Param | Type | Default | Notes |
|---|---|---|---|
| `include` | string | `programs` | `programs` = program nodes + program->program edges only. |
| `category` | string | – | filter program nodes by category |

### Response 200
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
  "meta": { "node_count": 61, "edge_count": 85, "include": "programs" }
}
```

**Notes for frontend:** `programs` is the clean, demo-friendly view — 61 nodes, ~85 edges, hubs flagged for emphasis. Use `category` filter to reduce for focused views.

---

## GET `/programs`
Catalog for browse/filter/search UI.

### Query params
| Param | Type | Notes |
|---|---|---|
| `category` | string | filter by category |
| `jurisdiction` | string | `federal` \| `AZ` \| `CA` \| `TX` |
| `hub` | bool | only hub programs |

### Response 200
```json
{
  "count": 61,
  "programs": [
    {
      "id": "snap",
      "name": "SNAP (Nutrition Assistance)",
      "agency": "USDA / AZ DES",
      "category": "nutrition",
      "jurisdiction": ["federal", "AZ"],
      "is_hub": true,
      "description": "Monthly food benefits on an EBT card.",
      "apply_url": "https://www.healthearizonaplus.gov",
      "effective_date": "2026-01"
    }
  ]
}
```

---

## Appendix — Enumerations (build intake forms from these)

### Enum: `verdict`
`likely_eligible` / `uncertain` / `ineligible`

### Enum: edge `relation`
`categorically_qualifies` (full auto-qualify) / `streamlines` (partial — satisfies named conditions only)

### Enum: `category` (program categories)
`nutrition` / `health` / `cash` / `cash_assistance` / `tax_credit` / `housing` / `energy` / `education` / `telecom`

### Enum: `categories` (household status flags — for the intake form checkboxes)
`pregnant` / `postpartum` / `infant` / `has_child_under_5` / `has_child` / `senior_65plus` / `disabled` / `blind` / `veteran` / `student` / `homeless` / `foster_child` / `native_american`
> Extensible — coordinate before adding new ones, since conditions reference these strings.

### Enum: `state`
2-letter USPS codes. Currently supported: `AZ`, `CA`, `TX`. Federal programs apply to all states; state-specific programs are gated by geographic conditions.

### Enum: program ids (61 programs)
**Hubs (4):** `snap` / `tanf` / `ssi` / `medicaid`

**Federal:** `wic` / `lifeline` / `liheap` / `school_meals` / `head_start` / `aca_ptc` / `eitc` / `ctc` / `savers_credit` / `extra_help` / `weatherization` / `summer_ebt` / `pell_grant` / `free_phone` / `snap_employment` / `snap_ed` / `csfp` / `tefap` / `federal_cdcc` / `fha_loan` / `veterans_pension` / `va_healthcare` / `ssdi` / `able_account` / `senior_nutrition` / `maternal_infant` / `acp_internet` / `earned_income_disregard` / `medicare_savings`

**AZ:** `chip` / `ccdf` / `section_8` / `az_family_assistance` / `az_childcare_tax` / `az_property_tax` / `transit_benefit` / `healthy_start` / `housing_choice` / `ga` / `foster_care_tuition` / `tanf_childcare` / `restaurant_meals` / `emergency_rental` / `az_140ptc` / `az_140et` / `msp` / `tribal_tanf`

**CA:** `ca_calfresh` / `ca_medi_cal` / `ca_calworks` / `ca_eitc` / `ca_yctc`

**TX:** `tx_snap` / `tx_medicaid` / `tx_tanf` / `tx_chip` / `tx_wic`

> `enrolled_in` most commonly uses the hubs (`snap`, `tanf`, `ssi`, `medicaid`), which drive categorical logic.

---

## Frozen vs. likely-to-change (so the frontend knows what's safe to build on)

- **Frozen (build against these now):** all endpoint paths, `Profile`, `EligibilityResult`, `Unlock`, `BenefitEstimate`, `/screen` and `/unlock` response envelopes, the enums.
- **May still change:** `explanation` field in agent mode (LLM-generated, wording varies), edge count as more rules are added.
- **Decision locked:** the structured `profile` is the **primary** path and the guaranteed contract; build the intake form against it (see `INTAKE.md`). Freeform `text` is an optional demo garnish — the frontend must be fully functional with the text box absent.
