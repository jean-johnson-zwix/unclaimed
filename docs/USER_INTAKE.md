# INTAKE.md — Unclaimed Onboarding / Intake Flow

**Purpose:** define the onboarding form that collects a `Profile` and calls `POST /screen`. This is a **frontend** spec — the backend contract (`Profile` in `API_SPEC.md`) does not change. Structured form is the **primary** path; freeform text is an **optional** quick-start (see §6).

**Design principles:**
- **Short by default.** Only 3 fields are truly required; everything else is optional or progressively disclosed. A user can get results after ~20 seconds.
- **The `enrolled_in` step is the star.** It drives the categorical cascade — the whole differentiator. Give it prominence, not a footnote.
- **Stateless & PII-light.** No account, no login, no persistence. Nothing is stored server-side. Say so in the UI to build trust (see §5).
- **Progressive payoff.** Minimal info → results → "answer 2 more to unlock N more" (§4).

---

## 1. Field → `Profile` mapping (the contract)

Every input maps to exactly one `Profile` field. This table is the build reference.

| UI input | Profile field | Type | Required | Input control |
|---|---|---|---|---|
| Household size | `household_size` | int ≥1 | ✔ | number stepper |
| Monthly income (gross) | `monthly_income` | number ≥0 | ✔ | number, USD/mo |
| State | `state` | string | ✔ (default `AZ`) | select (MVP: locked to `AZ`) |
| Your age | `age` | int \| null | – | number |
| Household status | `categories` | string[] | – | checkbox group (§2) |
| Currently receiving | `enrolled_in` | string[] | – | checkbox group (§3) — **prominent** |
| Countable assets | `assets` | number \| null | – | number (behind "Advanced") |
| Immigration status | `immigration_status` | string \| null | – | select, clearly skippable (§5) |

On submit: assemble these into a `Profile` and `POST /screen { "profile": {...} }`.

---

## 2. Household status — `categories` checkbox group

Valid values (from `API_SPEC.md` enum). Render as friendly labels; send the enum id.

| Enum id | Label | Show when |
|---|---|---|
| `pregnant` | Pregnant | always |
| `postpartum` | Recently gave birth (past 6 mo) | always |
| `infant` | Have an infant (under 1) | `household_size > 1` |
| `has_child_under_5` | Have a child under 5 | `household_size > 1` |
| `has_child` | Have a school-age child | `household_size > 1` |
| `senior_65plus` | Age 65 or older | **auto-set** if `age >= 65`; else offer |
| `disabled` | Have a disability | always |
| `blind` | Blind | always |
| `veteran` | Veteran | always |
| `student` | Enrolled student | always |
| `homeless` | Experiencing homelessness | always (optional, sensitive) |
| `foster_child` | Foster child in household | `household_size > 1` |

**Conditional logic:**
- Child-related options appear only when `household_size > 1` (no point asking a single-person household about kids).
- `senior_65plus` derives from `age` when provided — don't ask twice. If `age` is blank, offer the checkbox.
- Keep sensitive items (`homeless`, `foster_child`) present but never required or emphasized.

---

## 3. Currently receiving — `enrolled_in` (highest-leverage step)

Frame it warmly: **"Do you already get any of these? (This helps us find what else you may qualify for.)"** Enrolling in a hub cascades into many downstream programs, so this single step often produces most of the results.

**Lead with the 4 hubs** (biggest cascade), then the rest:

- ⭐ SNAP / Nutrition Assistance → `snap`
- ⭐ Cash Assistance (TANF) → `tanf`
- ⭐ SSI (Supplemental Security Income) → `ssi`
- ⭐ AHCCCS / Medicaid → `medicaid`
- WIC → `wic`, Lifeline → `lifeline`, LIHEAP/utility help → `liheap`, Section 8 → `section_8`, Medicare Savings → `msp`, Pell/other → *(as modeled)*

Full valid id list is the program-ids enum in `API_SPEC.md`. Default: none checked. This field is optional (a first-time claimant may receive nothing), but visually it should feel central, not skippable-by-accident.

---

## 4. Flow / steps

Keep it to **3 light steps** (or a single scroll with sections). Suggested order:

**Step 1 — Basics (required):** `household_size`, `monthly_income`, `state` (AZ, locked for MVP).
→ Enough to call `/screen` already. You *could* fire a first screen here for instant gratification.

**Step 2 — About your household (optional):** `age`, `categories`. Child options appear only if `household_size > 1`.

**Step 3 — Current benefits (optional, prominent):** `enrolled_in`.

**Advanced (collapsed):** `assets`, `immigration_status`.

**Submit → `POST /screen`.** Render `results`, `summary`, and `disclaimers` from the response.

### Progressive payoff loop (nice-to-have, high demo value)
After the first result, if any program came back `uncertain` or was skipped for missing data, surface: *"Answer 2 more questions to check 3 more programs."* Backend support exists (`get_missing_fields`, `EligibilityResult.needs_verification`). This turns intake into a reward loop and is a great live-demo beat: watch matches grow as the persona adds detail.

---

## 5. Trust & compliance UX (not optional)

Because you're asking for income, disability, and possibly immigration status, the UI must reassure and disclaim:

- **Above the form:** "We don't create an account or save your information — this runs in your browser session only." (Matches the stateless backend.)
- **`immigration_status`:** clearly optional and skippable. Helper text: "Optional. Immigration rules are complex and changing — we'll flag anything to verify with an agency, and we never recommend leaving benefits you have." Most immigration conditions are agency-verify anyway, so a blank value is fine.
- **On results:** render the `disclaimers` object from `/screen` verbatim (not-a-determination, immigration, general). Don't paraphrase them away.
- Never present a result as a guarantee — the backend already hedges ("appears likely eligible"); keep that language in the UI.

---

## 6. Freeform quick-start (optional demo garnish)

A secondary entry point, **not** the primary path:

1. Optional text box at the top: *"In a sentence, describe your situation."*
2. On submit → `POST /screen { "text": "..." }`.
3. Backend returns `resolved_profile` — **prefill the structured form with it and let the user confirm/correct** before the real screen.
4. If parsing fails (`400 unparseable_text`), fall back to the empty form silently.

Treat this as a delightful shortcut for the demo, never as a required step. The structured form is always available and is the guaranteed contract. Since freeform depends on the LLM intake parser (a stretch item), the form must be fully usable with the text box entirely absent.

---

## 7. Validation

- `household_size`: integer ≥ 1 (default 1).
- `monthly_income`: number ≥ 0; label it **gross** (before taxes); accept `$` and commas, strip before sending.
- `age`: 0–120 or blank.
- `categories` / `enrolled_in`: only enum ids from `API_SPEC.md`; ignore unknowns.
- `assets`: number ≥ 0 or blank.
- Send `null` (not empty string) for blank optional numeric/text fields.
- Client-side validate the two required numerics before enabling submit; the backend also returns `400 invalid_profile` / `422` as a backstop.