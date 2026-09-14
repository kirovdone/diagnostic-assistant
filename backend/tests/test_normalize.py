"""Normalisation traps, each named after the case that contains it."""

from __future__ import annotations

from diagnostic_assist.models import Case
from diagnostic_assist.normalize import (
    canonical_error_code,
    expand_abbreviations,
    extract_error_codes,
    extract_features,
    features_for_case,
    normalize_text,
)


class TestErrorCodes:
    def test_c48899_c49266_c49437_error_code_variants_all_normalize_to_e207(
        self, cases: dict[str, Case]
    ) -> None:
        """`E-207` (EN), `E207` (IT) and `err 207` (EN shorthand) are one fault code."""
        assert extract_error_codes(cases["C-48899"].customer_description)[0] == ("E207",)
        assert extract_error_codes(cases["C-49266"].customer_description)[0] == ("E207",)
        assert extract_error_codes(cases["C-49437"].customer_description)[0] == ("E207",)

    def test_error_code_variants_normalize_in_isolation(self) -> None:
        for variant in ("E-207", "E207", "e207", "err 207", "error 207", "ERR-207"):
            assert canonical_error_code(variant) == "E207"

    def test_c49355_lettered_code_keeps_its_own_scheme(self, cases: dict[str, Case]) -> None:
        """`LP-01` is the vendor's code, not ours. Uppercase it and leave it alone."""
        codes, absent = extract_error_codes(cases["C-49355"].customer_description)
        assert codes == ("LP-01",)
        assert absent is False

    def test_c49437_lowercase_shorthand_is_not_read_as_a_fault_code(
        self, cases: dict[str, Case]
    ) -> None:
        """`cyl 2` is a cylinder number, not code CYL-2."""
        codes, _ = extract_error_codes(cases["C-49437"].technician_notes)
        assert codes == ()


class TestNegation:
    def test_c48934_no_error_codes_displayed_is_absence_not_a_code(
        self, cases: dict[str, Case]
    ) -> None:
        """"No error codes displayed" must record absence, and never a code."""
        features = features_for_case(cases["C-48934"])
        assert features.error_codes == ()
        assert features.error_codes_absent is True

    def test_c48211_negation_about_something_else_does_not_claim_codes_are_absent(
        self, cases: dict[str, Case]
    ) -> None:
        """ "No lights on the control panel" is a negation, but not about codes."""
        features = features_for_case(cases["C-48211"])
        assert features.error_codes_absent is False

    def test_a_negated_code_is_not_extracted(self) -> None:
        codes, absent = extract_error_codes("Customer says no E-207 was ever shown.")
        assert codes == ()
        assert absent is True


class TestAbbreviations:
    def test_c48801_technician_shorthand_expands(self, cases: dict[str, Case]) -> None:
        """`hyd. lk @ boom cyl, ~1 drp/min` has to reach the same place as prose."""
        normalized = normalize_text(cases["C-48801"].customer_description)
        assert "hydraulic" in normalized
        assert "leak" in normalized
        assert "cylinder" in normalized
        assert "drop" in normalized

    def test_c48801_temp_fix_expands_to_temporary(self, cases: dict[str, Case]) -> None:
        assert "temporary fix" in normalize_text(cases["C-48801"].technician_notes)

    def test_c48899_temp_before_a_temperature_reading_does_not_expand(
        self, cases: dict[str, Case]
    ) -> None:
        """`Discharge temp 118C` is a temperature, not a temporary repair."""
        normalized = normalize_text(cases["C-48899"].technician_notes)
        assert "discharge temp 118c" in normalized
        assert "temporary" not in normalized

    def test_expansion_does_not_fire_inside_longer_words(self) -> None:
        assert expand_abbreviations("the customer called") == "the customer called"
        assert expand_abbreviations("temperature stable") == "temperature stable"


class TestSeverityAndOnset:
    def test_c48604_drip_and_c48755_puddle_are_different_severities(
        self, cases: dict[str, Case]
    ) -> None:
        assert features_for_case(cases["C-48604"]).severity == "drip"
        assert features_for_case(cases["C-48755"]).severity == "continuous"

    def test_c49002_recurrence_is_detected(self, cases: dict[str, Case]) -> None:
        assert features_for_case(cases["C-49002"]).recurrence == "yes"

    def test_silence_about_recurrence_is_unknown_not_a_denial(self, cases: dict[str, Case]) -> None:
        """C-49040 never says whether the fault is new. That is not the same as new."""
        assert features_for_case(cases["C-49040"]).recurrence == "unknown"

    def test_an_explicit_denial_is_recorded_as_no(self) -> None:
        assert extract_features("first occurrence, never happened before").recurrence == "no"

    def test_c49301_onset_when_cold(self, cases: dict[str, Case]) -> None:
        assert "cold" in features_for_case(cases["C-49301"]).onset_conditions

    def test_c48899_and_c49266_share_the_after_warmup_onset_across_languages(
        self, cases: dict[str, Case]
    ) -> None:
        """ "after 20 minutes" and "dopo circa 20 minuti" are the same onset condition."""
        assert "after_warmup" in features_for_case(cases["C-48899"]).onset_conditions
        assert "after_warmup" in features_for_case(cases["C-49266"]).onset_conditions

    def test_c48934_under_load(self, cases: dict[str, Case]) -> None:
        assert "under_load" in features_for_case(cases["C-48934"]).onset_conditions


class TestFluidClaim:
    def test_c48712_customer_claims_oil(self, cases: dict[str, Case]) -> None:
        assert features_for_case(cases["C-48712"]).fluid_claimed == "oil"

    def test_c49544_customer_claims_water(self, cases: dict[str, Case]) -> None:
        assert features_for_case(cases["C-49544"]).fluid_claimed == "water"

    def test_a_description_naming_both_fluids_stays_unknown(self) -> None:
        """Ambiguity must not resolve to a guess: this value is used to detect conflict."""
        assert extract_features("oil or water under the machine").fluid_claimed == "unknown"
