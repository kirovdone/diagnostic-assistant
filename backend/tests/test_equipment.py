"""Reading the machine out of the description."""

from __future__ import annotations

import pytest

from diagnostic_assist.corpus import sample_cases
from diagnostic_assist.equipment import resolve
from diagnostic_assist.models import EquipmentBasis

CATALOGUE = {
    "Aerial Platform AP": ("AP-120",),
    "Air Compressor CX": ("CX-300", "CX-450"),
    "Water Chiller CH": ("CH-200", "CH-350"),
}


class TestTypeCodes:
    @pytest.mark.parametrize("written", ["CX-450", "cx450", "CX 450", "unit cx-450 on site"])
    def test_a_type_code_is_read_in_any_of_its_spellings(self, written: str) -> None:
        guess = resolve(f"{written} will not start", CATALOGUE)
        assert guess.equipment_type == "CX-450"
        assert guess.family == "Air Compressor CX"
        assert guess.basis is EquipmentBasis.TYPE_CODE

    def test_a_type_we_hold_no_cases_for_is_not_a_scope(self) -> None:
        """An invented type is not evidence about the machine, it is a typo."""
        assert not resolve("ZZ-999 will not start", CATALOGUE).resolved

    def test_a_type_code_does_not_match_inside_a_longer_one(self) -> None:
        """CH-200 inside CH-2000 is the wrong machine, and reads exactly like the right one."""
        assert not resolve("CH-2000 is leaking", CATALOGUE).resolved


class TestNamingTheMachine:
    @pytest.mark.parametrize(
        ("text", "family"),
        [
            ("compressor will not start", "Air Compressor CX"),
            ("Kompressor startet nicht", "Air Compressor CX"),
            ("le compresseur ne demarre pas", "Air Compressor CX"),
            ("nacelle, fuite hydraulique", "Aerial Platform AP"),
            ("Hubarbeitsbuehne sackt ab", "Aerial Platform AP"),
            ("chiller is not cooling", "Water Chiller CH"),
            ("Kaltwassersatz kuehlt nicht", "Water Chiller CH"),
        ],
    )
    def test_the_machine_named_in_four_languages(self, text: str, family: str) -> None:
        guess = resolve(text, CATALOGUE)
        assert guess.family == family
        assert guess.basis is EquipmentBasis.FAMILY_NAME


class TestNamingOnlyThePart:
    """The case that earns the component table."""

    @pytest.mark.parametrize(
        ("text", "family"),
        [
            ("hyd. lk @ boom cyl, ~1 drp/min", "Aerial Platform AP"),
            ("Fuite au niveau du verin de fleche", "Aerial Platform AP"),
            ("Klopfgeraeusch im Zylinder, wird unter Last lauter", "Air Compressor CX"),
            ("no crank, dead panel", "Air Compressor CX"),
            ("valve plate worn, reed cracked", "Air Compressor CX"),
            ("condensate drain line is blocked", "Water Chiller CH"),
            ("slow water drip on the cold water side", "Water Chiller CH"),
        ],
    )
    def test_a_part_only_one_family_has(self, text: str, family: str) -> None:
        guess = resolve(text, CATALOGUE)
        assert guess.family == family
        assert guess.basis is EquipmentBasis.COMPONENT


class TestDecliningToGuess:
    def test_a_description_that_names_nothing_resolves_nothing(self) -> None:
        """ "Unit won't start at all" is three of the 22 cases and names no machine."""
        guess = resolve("Unit won't start at all. No lights on the control panel.", CATALOGUE)
        assert not guess.resolved
        assert guess.matched_families == ()

    def test_two_families_is_ambiguity_not_a_tie_to_break(self) -> None:
        guess = resolve("boom cylinder leak and the condenser is blocked", CATALOGUE)
        assert not guess.resolved
        assert set(guess.matched_families) == {"Aerial Platform AP", "Water Chiller CH"}

    def test_naming_the_machine_beats_naming_a_part(self) -> None:
        """A compressor with a boom-shaped word in it is still a compressor."""
        guess = resolve("compressor, knocking from the boom area", CATALOGUE)
        assert guess.family == "Air Compressor CX"
        assert guess.basis is EquipmentBasis.FAMILY_NAME

    def test_a_family_the_catalogue_does_not_hold_is_not_offered(self) -> None:
        """The tables outlive the corpus, so a cue for a machine we hold no cases for is
        not an answer: there is nothing to rank against."""
        assert not resolve("chiller is not cooling", {"Air Compressor CX": ("CX-450",)}).resolved


class TestAgainstTheRealCorpus:
    def test_it_never_names_the_wrong_family(self) -> None:
        """The number that matters. Declining is free; a wrong scope is not."""
        wrong = [
            (case.case_id, guess.family, case.equipment_family)
            for case in sample_cases()
            if (guess := resolve(case.customer_description, CATALOGUE)).resolved
            and guess.family != case.equipment_family
        ]
        assert wrong == []

    def test_it_resolves_more_than_half_the_corpus(self) -> None:
        """A resolver that always declines is safe and useless. This pins the floor."""
        resolved = [
            case.case_id
            for case in sample_cases()
            if resolve(case.customer_description, CATALOGUE).resolved
        ]
        assert len(resolved) >= 12
