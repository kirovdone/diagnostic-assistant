"""The arithmetic in the evaluation script.

The script prints the numbers the submission is judged on, and nothing checked it. Its
baseline once credited the lookup table with an answer drawn from an empty table, which
flattered the margin by twenty points; these pin the pieces that bug lived in.
"""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from eval_rank import _single_commonest, lookup_table_hit, wilson

from diagnostic_assist.models import Case


def _case(equipment_type: str, family: str = "Air Compressor CX") -> Case:
    return Case(
        case_id="C-00001",
        equipment_family=family,
        equipment_type=equipment_type,
        created_at="2026-01-01T00:00:00Z",
        language="en",
        customer_description="x",
        technician_notes="y",
        parts_replaced=(),
        resolution_text="z",
    )


class TestWilson:
    def test_the_intervals_are_the_ones_quoted_in_the_readme(self) -> None:
        assert wilson(8, 19) == "23-64%"
        assert wilson(10, 19) == "32-73%"

    def test_an_empty_sample_has_no_interval(self) -> None:
        assert wilson(0, 0) == "--"


class TestCommonest:
    def test_a_clear_winner_is_returned(self) -> None:
        assert _single_commonest(Counter({"a": 3, "b": 1})) == "a"

    def test_a_tie_has_no_commonest_cause(self) -> None:
        """A lookup table that has to flip a coin has not answered."""
        assert _single_commonest(Counter({"a": 2, "b": 2})) is None

    def test_an_empty_table_has_no_commonest_cause(self) -> None:
        assert _single_commonest(Counter()) is None


class TestLookupTableBaseline:
    def test_a_type_whose_only_case_is_the_held_out_one_scores_nothing(self) -> None:
        """The bug this replaced: a Counter holding one zero is still truthy, so the table
        was credited with the very answer that had just been removed from it."""
        by_type = {"CX-300": Counter({"CX.MECH.REED_VALVE_BROKEN": 1})}
        by_family = {"Air Compressor CX": Counter({"CX.MECH.REED_VALVE_BROKEN": 1})}
        assert not lookup_table_hit(
            _case("CX-300"), "CX.MECH.REED_VALVE_BROKEN", by_type, by_family
        )

    def test_a_tie_is_a_miss(self) -> None:
        by_type = {"AP-120": Counter({"AP.HYD.ROD_SEAL": 1, "AP.HYD.SCORED": 1})}
        assert not lookup_table_hit(_case("AP-120"), "AP.HYD.ROD_SEAL", by_type, {})

    def test_the_commonest_remaining_cause_for_the_type_counts(self) -> None:
        by_type = {"CX-450": Counter({"CX.ELEC.CONTACTOR_FAILED": 4, "CX.COOL.INTAKE_BLOCKED": 1})}
        assert lookup_table_hit(_case("CX-450"), "CX.ELEC.CONTACTOR_FAILED", by_type, {})

    def test_an_empty_type_falls_back_to_the_family_like_the_ranker(self) -> None:
        """C-49437's shape: the only case of its type. The tables are built from the votable
        set including the held-out case, so its own cause is in them before it is removed."""
        by_type = {"CX-300": Counter({"CX.ELEC.CONTACTOR_FAILED": 1})}
        by_family = {
            "Air Compressor CX": Counter(
                {"CX.ELEC.CONTACTOR_FAILED": 4, "CX.MECH.REED_VALVE_BROKEN": 1}
            )
        }
        assert lookup_table_hit(_case("CX-300"), "CX.ELEC.CONTACTOR_FAILED", by_type, by_family)
