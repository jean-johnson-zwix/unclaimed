from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class Profile(BaseModel):
    household_size: int
    monthly_income: float
    state: str = "AZ"
    age: int | None = None
    categories: list[str] = []
    enrolled_in: list[str] = []
    assets: float | None = None
    immigration_status: str | None = None


class ConditionResult(BaseModel):
    condition_id: str
    label: str = ""
    passed: bool | None = None
    detail: str = ""
    source_url: str | None = None


class EligibilityResult(BaseModel):
    program_id: str
    program_name: str = ""
    category: str = ""
    verdict: Literal["likely_eligible", "ineligible", "uncertain"]
    matched: list[ConditionResult] = []
    failed: list[ConditionResult] = []
    needs_verification: list[ConditionResult] = []
    unlocks: list[Unlock] = []
    estimated_benefit: dict | None = None
    apply_url: str = ""
    effective_date: str = ""


class Unlock(BaseModel):
    program_id: str
    program_name: str = ""
    relation: str = ""
    hop: int = 1
    satisfies: list[str] | None = None


class ProgramSummary(BaseModel):
    id: str
    name: str = ""
    agency: str = ""
    category: str = ""
    jurisdiction: list[str] = []
    is_hub: bool = False
    description: str = ""
    conditions_summary: str = ""
    apply_url: str = ""
    effective_date: str = ""


class Disclaimers(BaseModel):
    not_a_determination: str = "This is a preliminary screening, not an official eligibility determination. Verify with each agency."
    immigration: str = "Immigration-related eligibility is complex and changing (Nov 2025 DHS public-charge proposal). Consult an immigration attorney; do not disenroll from benefits based on this tool."
    general: str = "Estimates are based on the information provided and rules effective as of the dates shown."
