# frontend_spec.md — Unclaimed Frontend

**For:** frontend owner. **Pairs with:** `API_SPEC.md` (the contract — source of truth for every request/response shape), `INTAKE.md` (the onboarding form fields).

**The product in one line:** enter your household situation → see the government benefits you're likely leaving unclaimed, in dollars, each traceable to a real rule, plus what enrolling in one *unlocks*.

**The one thing that matters most:** `summary.estimated_total_annual` — the total dollars unclaimed — is the hero of the whole UI. Everything is arranged around making that number land. Don't bury it in a stat bar; it's the emotional payoff the whole demo builds to.

---

## 0. The demo spine (build this path first, polish later)

Four screens, one story. If everything else slips, this must be flawless:

```
Intake form  →  BIG animated $ number  →  Result cards with cited "why"
             →  click SSI → cascade animates  →  zoom out to full graph
```

Everything in §7 (Polish) is optional until this spine works end-to-end.

---

## 1. Tech stack (recommended)

- **React + TypeScript + Tailwind** (per the original stack).
- **Framer Motion** — the count-up number, card entrances, and cascade reveal are all motion moments; this library earns its place.
- **Graph rendering:** `react-force-graph-2d` (or `d3-force`) for `/unlock` and `/graph`. 2D is enough; don't reach for 3D.
- **State:** local component state + a light store (Zustand/Context) for the resolved profile + results. No routing library strictly needed — this can be a few views toggled by app state.
- **No accounts, no persistence, no localStorage** — the backend is stateless and PII-light by design; mirror that. Keep everything in memory for the session.

---

## 2. Views & features (mapped to the API)

Priority: **MVP** (demo spine) · **CORE** (strongly wanted) · **POLISH** (if time).

### View A — Intake / Onboarding · MVP
Produces a `Profile`, calls `POST /screen`.

| Feature | API | Priority |
|---|---|---|
| 3-step structured form (basics → household → benefits) | builds `Profile` | MVP |
| Field flow, conditional logic, validation | see `INTAKE.md` | MVP |
| **State selector (AZ / CA / TX)** | `Profile.state` — now multi-state, **not locked** | MVP |
| `enrolled_in` step given visual prominence (drives the cascade) | `Profile.enrolled_in` · enum in `API_SPEC.md` | MVP |
| Household status checkboxes | `Profile.categories` · enum in `API_SPEC.md` | MVP |
| "We don't save your info" trust line + verbatim disclaimers | — | MVP |
| Optional freeform quick-start box → prefill form | `POST /screen { text }` → `resolved_profile` | POLISH |

> Freeform is a garnish: the form must be fully usable with the text box absent. On `422 intake_failed`, silently fall back to the empty form.

### View B — Results · MVP · the core payoff

| Feature | API field | Priority |
|---|---|---|
| **Hero: animated count-up of total unclaimed $** | `summary.estimated_total_annual` | MVP |
| Result cards grouped by verdict (`likely_eligible`, then `uncertain`) | `results[]` (pre-sorted) · `verdict` | MVP |
| Per-card dollar value ($/mo · $/yr) | `estimated_benefit.estimated_monthly` / `.estimated_annual` | MVP |
| Category color-coding | `category` (7+ values, see enum) | MVP |
| Apply button | `apply_url` | MVP |
| **"Why you qualify" expandable panel — cited** | `matched[]` → `label` + `detail` + `source_url` | MVP |
| **"Almost — do this" panel** on uncertain cards | `needs_verification[]` | CORE |
| "Unlocks N more →" chip (opens View C) | `unlocks[]` (length) | MVP |
| Agent-mode explanation banner | `explanation` (present when `mode:"agent"`) | POLISH |
| Summary counts (N eligible · M to verify · K checked) | `summary.*` | CORE |
| Disclaimers footer, verbatim | `disclaimers` | MVP |

**Card anatomy (the atom of this view):**
```
┌─────────────────────────────────────────┐
│ [category dot] SNAP (Nutrition Assistance)│
│ ~$616/mo · ~$7,392/yr        ● likely     │
│ Why you qualify ▸  (expands matched[])    │
│ Unlocks 1 more →     [ Apply ]            │
└─────────────────────────────────────────┘
```
The **Why** expansion is your credibility layer — render each `matched` condition as `label` + `detail` with the `source_url` as a clickable citation. "Every number traceable to a rule" is the trust story; make it visible.

### View C — Cascade / Unlock viz · MVP · the money-shot

| Feature | API | Priority |
|---|---|---|
| Force-graph rooted at a program | `POST /unlock { program_id }` → `nodes` + `edges` | MVP |
| Layout by hop (root center/left, rings outward) | `nodes[].hop` | MVP |
| Edge styling: solid `categorically_qualifies` vs dashed `streamlines` | `edges[].relation` | MVP |
| `satisfies` tooltip on dashed edges | `edges[].satisfies` | CORE |
| **Hop-by-hop reveal animation** | animate on `hop` order | MVP |
| Node → program detail / apply | `nodes[].id` → View E | POLISH |

> This is the three seconds that wins the room. Triggered from a result card's "Unlocks N more" chip (start with SSI). Reveal outward: root → hop 1 → hop 2. Don't render it all at once.

### View D — Explore / Full graph · CORE

| Feature | API | Priority |
|---|---|---|
| Full program web, hubs enlarged | `GET /graph` → 61 nodes / ~85 edges | CORE |
| **Category filter + legend** (essential at this node count) | `GET /graph?category=` · `is_hub` | CORE |
| Same edge styling as View C | `edges[].relation` | CORE |
| Click node → its `/unlock` mini-cascade | `nodes[].id` → View C | POLISH |

> The visual argument: "the safety net is a tangled web, not a list — that's *why* people miss things." At 61/85 it's a hairball without filtering; default to hubs + one category, let users expand.

### View E — Program catalog / detail · POLISH

| Feature | API | Priority |
|---|---|---|
| Browse/search all programs | `GET /programs` | POLISH |
| Filter by category / jurisdiction / hub | `GET /programs?category=&jurisdiction=&hub=` | POLISH |
| Program detail → "what this unlocks" | `POST /unlock { program_id }` per program | POLISH |

> Lower demo priority, but good employer-facing depth for the Kanz judges. Note `/programs` returns summaries only (no conditions) — see coordination gaps §5.

---

## 3. Global UI concerns

- **Loading states:** `/screen` may run the LLM in agent mode; show a "checking 61 programs…" state. `/unlock` and `/graph` are fast.
- **Empty/edge cases:** zero `likely_eligible` (show `uncertain` + encouragement, never a dead end); `estimated_total_annual: null` (hide the hero number gracefully, don't show "$null").
- **Errors:** render `ErrorResponse.error.message`. Key ones: `422 missing_profile`, `422 intake_failed`, `404 unknown_program`.
- **Category color system:** define one palette for the 9 categories (`nutrition`, `health`, `cash`, `cash_assistance`, `tax_credit`, `housing`, `energy`, `education`, `telecom`) and reuse it in cards, graph nodes, and legend. Consistency here makes the whole app feel designed.
- **Mobile:** the intake + results should work on a phone (judges may open it on one). The graph views can be desktop-first.
- **Accessibility of the "why":** citations should be real links (`source_url`), not decorative.

---

## 4. Category color palette (suggested — pick your own, but define it once)

| Category | Suggested hue |
|---|---|
| `nutrition` | green |
| `health` | red/coral |
| `cash` / `cash_assistance` | amber |
| `tax_credit` | violet |
| `housing` | blue |
| `energy` | orange |
| `education` | teal |
| `telecom` | slate |

---

## 5. Coordination gaps (resolve with backend before building these)

These are places where a natural frontend feature needs a backend decision. Flagging so you don't design against something that isn't served:

1. **Ineligible programs are omitted from `/screen`.** If you want a "we checked 61, here's why 40 don't fit" transparency element, the backend must return `ineligible` results too. **Ask before designing it** — it's a response-shape change.
2. **Second dollar number for uncertain results.** `estimated_total_annual` sums only `likely_eligible`. `uncertain` cards also carry `estimated_benefit`. If you want an "up to $Y more if you verify these" figure, backend needs to expose `estimated_potential_annual`. Worth requesting — it makes uncertain cards feel actionable.
3. **Program detail has no conditions/unlocks.** `/programs` returns summaries only. A rich detail modal needs either a `/programs/{id}` endpoint or you stitch `/unlock` per program. Confirm which is supported before building View E's detail.

---

## 6. Build order (frontend)

1. **Intake form** → `POST /screen` → dump raw JSON on screen (proves the contract end-to-end).
2. **Results view**: hero number + basic cards (name, $, apply). *This is the MVP payoff.*
3. **"Why" expansion** with citations.
4. **Cascade viz** (`/unlock`) with hop reveal — wire the "Unlocks N more" chip.
5. **Full graph** (`/graph`) with category filter + legend.
6. Uncertain "almost — do this" panel · agent explanation banner.
7. **Polish:** freeform quick-start, program catalog, node-click drilldowns, motion tuning.

Mock against the exact JSON examples in `API_SPEC.md` from day one — every response shape has a worked example there, so you're never blocked waiting on the backend.

---

## 7. Definition of done (demo readiness)

- [ ] Single-mother persona: intake → results with a big animated $ number.
- [ ] At least one card shows cited `matched` conditions with working `source_url` links.
- [ ] "Unlocks N more" on an SSI-linked result opens the cascade.
- [ ] SSI `/unlock` cascade animates hop-by-hop, edge styles distinct.
- [ ] Full `/graph` renders with hubs emphasized and a working category filter.
- [ ] Disclaimers visible on results; nothing says "you qualify" (only "likely").
- [ ] Works on a phone screen for intake + results.