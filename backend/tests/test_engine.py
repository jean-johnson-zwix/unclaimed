import pytest

from app.engine.conditions import check_condition
from app.engine.evaluate import evaluate_program
from app.graph.loader import load_all_rules
from app.graph.store import graph_store
from app.models import Profile


@pytest.fixture(autouse=True, scope="module")
def _load_rules():
    if graph_store.program_count() == 0:
        load_all_rules()


class TestCheckCondition:
    def test_income_at_threshold(self):
        cond = {"id": "test", "type": "income_threshold", "operator": "<=", "value": 200, "unit": "pct_fpl"}
        fpl = {"annual": 15960, "monthly": 1330}
        profile = Profile(household_size=1, monthly_income=2660)  # exactly 200% FPL
        result = check_condition(cond, profile, fpl)
        assert result.passed is True

    def test_income_over_threshold(self):
        cond = {"id": "test", "type": "income_threshold", "operator": "<=", "value": 200, "unit": "pct_fpl"}
        fpl = {"annual": 15960, "monthly": 1330}
        profile = Profile(household_size=1, monthly_income=2661)  # $1 over
        result = check_condition(cond, profile, fpl)
        assert result.passed is False

    def test_income_floor(self):
        cond = {"id": "test", "type": "income_threshold", "operator": ">=", "value": 100, "unit": "pct_fpl"}
        fpl = {"annual": 15960, "monthly": 1330}
        profile = Profile(household_size=1, monthly_income=1000)
        result = check_condition(cond, profile, fpl)
        assert result.passed is False

    def test_age_passes(self):
        cond = {"id": "test", "type": "age", "operator": ">=", "value": 65}
        result = check_condition(cond, Profile(household_size=1, monthly_income=0, age=65), {})
        assert result.passed is True

    def test_age_missing(self):
        cond = {"id": "test", "type": "age", "operator": ">=", "value": 65}
        result = check_condition(cond, Profile(household_size=1, monthly_income=0), {})
        assert result.passed is None

    def test_asset_passes(self):
        cond = {"id": "test", "type": "asset", "operator": "<=", "value": 2000, "unit": "usd"}
        result = check_condition(cond, Profile(household_size=1, monthly_income=0, assets=1999), {})
        assert result.passed is True

    def test_asset_fails(self):
        cond = {"id": "test", "type": "asset", "operator": "<=", "value": 2000, "unit": "usd"}
        result = check_condition(cond, Profile(household_size=1, monthly_income=0, assets=2001), {})
        assert result.passed is False

    def test_categorical_includes_any(self):
        cond = {"id": "test", "type": "categorical", "operator": "includes_any", "value": ["pregnant", "disabled"]}
        result = check_condition(cond, Profile(household_size=1, monthly_income=0, categories=["pregnant"]), {})
        assert result.passed is True

    def test_categorical_excludes(self):
        cond = {"id": "test", "type": "categorical", "operator": "excludes", "value": ["student"]}
        result = check_condition(cond, Profile(household_size=1, monthly_income=0, categories=["student"]), {})
        assert result.passed is False

    def test_geographic_in(self):
        cond = {"id": "test", "type": "geographic", "operator": "in", "value": ["AZ"]}
        result = check_condition(cond, Profile(household_size=1, monthly_income=0, state="AZ"), {})
        assert result.passed is True

    def test_geographic_not_in(self):
        cond = {"id": "test", "type": "geographic", "operator": "in", "value": ["AZ"]}
        result = check_condition(cond, Profile(household_size=1, monthly_income=0, state="CA"), {})
        assert result.passed is False

    def test_clinical_always_uncertain(self):
        cond = {"id": "test", "type": "clinical", "description": "Needs clinic visit"}
        result = check_condition(cond, Profile(household_size=1, monthly_income=0), {})
        assert result.passed is None


class TestEvaluateProgram:
    def test_categorical_short_circuit(self):
        profile = Profile(household_size=1, monthly_income=800, enrolled_in=["ssi"], categories=["disabled"])
        result = evaluate_program("medicaid", profile)
        assert result.verdict == "likely_eligible"
        assert "categorical" in result.matched[0].condition_id

    def test_ineligible_income_over(self):
        profile = Profile(household_size=1, monthly_income=5000)
        result = evaluate_program("snap", profile)
        assert result.verdict == "ineligible"

    def test_adjunctive_streamlines(self):
        profile = Profile(
            household_size=3,
            monthly_income=2000,
            enrolled_in=["snap"],
            categories=["pregnant", "has_child_under_5"],
        )
        result = evaluate_program("wic", profile)
        assert result.verdict == "uncertain"
        adjunctive_ids = [m.condition_id for m in result.matched]
        assert "wic_income" in adjunctive_ids
        assert any(n.condition_id == "wic_nutritional_risk" for n in result.needs_verification)

    def test_or_group_one_passes(self):
        profile = Profile(household_size=2, monthly_income=1000, categories=["pregnant"])
        result = evaluate_program("wic", profile)
        cat_matched = [m for m in result.matched if m.condition_id == "wic_category"]
        assert len(cat_matched) == 1

    def test_verifiable_false_returns_uncertain(self):
        profile = Profile(household_size=3, monthly_income=1000, categories=["has_child"])
        result = evaluate_program("section_8", profile)
        assert result.verdict == "uncertain"
        assert any(n.condition_id == "section_8_waitlist" for n in result.needs_verification)

    def test_likely_eligible_all_pass(self):
        profile = Profile(household_size=3, monthly_income=1000, categories=["has_child"])
        result = evaluate_program("school_meals", profile)
        assert result.verdict == "likely_eligible"

    def test_unknown_program_returns_none(self):
        profile = Profile(household_size=1, monthly_income=0)
        result = evaluate_program("nonexistent", profile)
        assert result is None
