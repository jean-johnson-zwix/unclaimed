"""Benefit dollar-value estimates. Uses static lookup tables (not PolicyEngine API)
since PolicyEngine's free tier is unreliable for hackathon demos.

ponytail: static table, upgrade to PolicyEngine API if accuracy matters post-hackathon.
"""

from __future__ import annotations

from app.models import Profile

# Average monthly benefit estimates by program, indexed by household_size brackets
# Sources: CBPP, USDA, IRS, CMS published averages for 2025-2026
BENEFIT_TABLE: dict[str, dict] = {
    "snap": {"monthly": {1: 234, 2: 430, 3: 616, 4: 782, 5: 929, 6: 1114}, "unit": "monthly"},
    "tanf": {"monthly": {1: 275, 2: 378, 3: 462, 4: 539, 5: 616, 6: 693}, "unit": "monthly"},
    "ssi": {"monthly": {1: 943, 2: 1415}, "unit": "monthly"},
    "medicaid": {"annual": {1: 7000, 2: 12000, 3: 16000, 4: 20000}, "unit": "annual", "note": "estimated value of coverage"},
    "wic": {"monthly": {1: 50, 2: 75, 3: 100, 4: 120}, "unit": "monthly"},
    "lifeline": {"monthly": {1: 9.25}, "unit": "monthly", "note": "phone/internet discount"},
    "liheap": {"annual": {1: 500, 2: 600, 3: 700, 4: 800}, "unit": "annual"},
    "school_meals": {"monthly": {1: 140, 2: 200, 3: 280, 4: 350}, "unit": "monthly", "note": "per child, ~$7/day"},
    "head_start": {"annual": {1: 12000}, "unit": "annual", "note": "value of free preschool"},
    "section_8": {"monthly": {1: 800, 2: 1000, 3: 1200, 4: 1400}, "unit": "monthly", "note": "housing voucher avg"},
    "aca_ptc": {"monthly": {1: 450, 2: 700, 3: 900, 4: 1100}, "unit": "monthly", "note": "premium tax credit"},
    "eitc": {"annual": {0: 600, 1: 3995, 2: 6604, 3: 7430}, "unit": "annual", "note": "depends on children"},
    "ctc": {"annual": {1: 2000, 2: 4000, 3: 6000, 4: 8000}, "unit": "annual", "note": "$2000/child"},
    "savers_credit": {"annual": {1: 1000, 2: 2000}, "unit": "annual"},
    "extra_help": {"annual": {1: 5000, 2: 5000}, "unit": "annual", "note": "Medicare Part D savings"},
    "weatherization": {"annual": {1: 4000}, "unit": "annual", "note": "one-time home improvements"},
    "summer_ebt": {"annual": {1: 120, 2: 240, 3: 360}, "unit": "annual", "note": "$40/child/month summer"},
    "az_140ptc": {"annual": {1: 100, 2: 100, 3: 100}, "unit": "annual"},
    "az_140et": {"annual": {1: 100, 2: 100, 3: 100}, "unit": "annual"},
    "msp": {"monthly": {1: 185, 2: 185}, "unit": "monthly", "note": "Medicare premium savings"},
}


def estimate_benefit(program_id: str, profile: Profile) -> dict | None:
    entry = BENEFIT_TABLE.get(program_id)
    if not entry:
        return None

    hs = profile.household_size
    unit = entry["unit"]

    if unit == "monthly":
        table = entry["monthly"]
        monthly = table.get(hs, table.get(max(k for k in table if k <= hs), list(table.values())[-1]))
        annual = monthly * 12
    else:
        table = entry["annual"]
        # For EITC, key is number of children not household_size
        if program_id == "eitc":
            children = max(0, hs - 1)
            annual = table.get(children, table.get(max(table.keys()), 0))
        else:
            annual = table.get(hs, table.get(max(k for k in table if k <= hs), list(table.values())[-1]))
        monthly = round(annual / 12)

    return {
        "estimated_annual": annual,
        "estimated_monthly": monthly,
        "note": entry.get("note", "average benefit estimate"),
        "source": "CBPP/USDA/IRS published averages 2025-2026",
    }
