"""Retrieval, ranking and question selection."""

from __future__ import annotations

import pytest

from diagnostic_assist import questions
from diagnostic_assist.config import DEGRADED_EVIDENCE_MASS, MAX_CANDIDATES
from diagnostic_assist.models import Case, CaseLabel, SymptomFeatures
from diagnostic_assist.normalize import extract_features
from diagnostic_assist.questions import TEMPLATES, next_question
from diagnostic_assist.ranking import rank
from diagnostic_assist.retrieval import CaseIndex, Neighbour

from .stubs import StubSimilarity


@pytest.fixture(scope="session")
def index(cases: dict[str, Case], labels: dict[str, CaseLabel]) -> CaseIndex:
    return CaseIndex(list(cases.values()), labels, similarity=StubSimilarity())


class TestRetrieval:
    def test_cases_that_cannot_vote_are_not_indexed(
        self, index: CaseIndex, labels: dict[str, CaseLabel]
    ) -> None:
        """The billing dispute, the warranty swap and the no-fault-found visit."""
        indexed = {entry.case.case_id for entry in index.entries}
        assert "C-49118" not in indexed
        assert "C-49203" not in indexed
        assert "C-49301" not in indexed
        assert len(indexed) == 19

    def test_a_contactor_description_retrieves_the_contactor_cases(self, index: CaseIndex) -> None:
        result = index.search(
            "Unit will not start, no lights on the panel at all",
            "Air Compressor CX",
            "CX-450",
        )
        found = {n.case_id for n in result.neighbours}
        assert {"C-48211", "C-48590"} & found

    def test_c49437_rare_equipment_type_backs_off_to_the_family(self, index: CaseIndex) -> None:
        """CX-300 has one labelled case in the whole corpus."""
        result = index.search(
            "Knocking noise from cylinder 2, display flashed a code once",
            "Air Compressor CX",
            "CX-300",
        )
        assert result.fallback_level == "family"
        assert len(result.neighbours) > 1

    def test_a_known_family_never_widens_past_itself(self, index: CaseIndex) -> None:
        """Widening past the family can only add causes the machine cannot have."""
        result = index.search("Leak from the boom cylinder", "Aerial Platform AP", "AP-120")
        assert result.fallback_level == "family"
        assert {n.case_id for n in result.neighbours} <= {"C-48604", "C-48755", "C-48801"}

    def test_an_unknown_family_searches_everything_and_says_so(self, index: CaseIndex) -> None:
        """The only case where a global search is the right thing to do."""
        result = index.search("strange noise", "Unknown Family", "ZZ-999")
        assert result.fallback_level == "global"

    def test_the_fluid_feature_bridges_to_a_case_with_no_shared_characters(
        self, index: CaseIndex
    ) -> None:
        """C-48755 is French. Its text similarity to an English query is exactly zero."""
        without = index.search("Leak from the boom cylinder", "Aerial Platform AP", "AP-120")
        assert "C-48755" not in {n.case_id for n in without.neighbours}

        with_fluid = index.search("Oil leak from the boom cylinder", "Aerial Platform AP", "AP-120")
        bridged = next(n for n in with_fluid.neighbours if n.case_id == "C-48755")
        assert bridged.similarity > 0

    def test_structured_features_cross_languages_where_the_characters_do_not(
        self, index: CaseIndex
    ) -> None:
        """A German query finds the German case on text, and the English one on features."""
        result = index.search(
            "Maschine startet nicht, keine Anzeige am Display",
            "Air Compressor CX",
            "CX-450",
        )
        ranked = [n.case_id for n in result.neighbours]
        assert ranked[0] == "C-48377"
        assert ranked.index("C-48377") < ranked.index("C-48211")


class TestRanking:
    def _neighbour(
        self, case_id: str, cause_id: str, similarity: float, weight: float
    ) -> Neighbour:
        return Neighbour(
            case_id=case_id,
            cause_id=cause_id,
            similarity=similarity,
            evidence_weight=weight,
            features=SymptomFeatures(),
        )

    def test_probabilities_and_the_other_share_sum_to_one(self) -> None:
        """The displayed numbers have to add up, or the unknown share is understated."""
        neighbours = tuple(
            self._neighbour(f"C-{i}", "CX.ELEC.CONTACTOR_FAILED", 0.5, 1.0) for i in range(3)
        )
        ranking = rank(neighbours, "type")
        total = sum(c.probability for c in ranking.candidates) + ranking.other_probability
        assert total == pytest.approx(1.0, abs=1e-9)

    def test_trimmed_candidates_are_added_to_other_rather_than_dropped(self) -> None:
        """Hiding the tail must not quietly inflate the visible causes."""
        neighbours = tuple(
            self._neighbour(f"C-{i}", f"CAUSE-{i}", 0.9 - i * 0.01, 1.0) for i in range(12)
        )
        # Cause ids that are not in the taxonomy are skipped by rank(), so use real ones.
        real = (
            "CX.ELEC.CONTACTOR_FAILED",
            "CX.ELEC.GROUND_STRAP_LOOSE",
            "CX.ELEC.BATTERY_FAILED",
            "CX.ELEC.ALTERNATOR_NOT_CHARGING",
            "CX.MECH.VALVE_PLATE_WORN",
            "CX.MECH.REED_VALVE_BROKEN",
            "CX.MECH.CONROD_BEARING_WORN",
            "CX.COOL.INTAKE_BLOCKED",
        )
        neighbours = tuple(
            self._neighbour(f"C-{i}", cause, 0.9 - i * 0.05, 1.0) for i, cause in enumerate(real)
        )
        ranking = rank(neighbours, "type")
        assert len(ranking.candidates) <= MAX_CANDIDATES
        total = sum(c.probability for c in ranking.candidates) + ranking.other_probability
        assert total == pytest.approx(1.0, abs=1e-9)

    def test_a_provisional_case_votes_at_a_quarter_of_a_confirmed_one(self) -> None:
        confirmed = rank((self._neighbour("a", "CX.ELEC.BATTERY_FAILED", 0.6, 1.0),), "type")
        provisional = rank((self._neighbour("a", "CX.ELEC.BATTERY_FAILED", 0.6, 0.25),), "type")
        assert confirmed.candidates[0].probability > provisional.candidates[0].probability

    def test_the_other_share_grows_when_retrieval_has_to_back_off(self) -> None:
        """Backing off to the family is exactly when our taxonomy is least likely to fit."""
        neighbours = (self._neighbour("a", "CX.ELEC.BATTERY_FAILED", 0.6, 1.0),)
        by_type = rank(neighbours, "type")
        by_family = rank(neighbours, "family")
        by_global = rank(neighbours, "global")
        assert by_type.other_probability < by_family.other_probability
        assert by_family.other_probability < by_global.other_probability

    def test_thin_evidence_is_marked_degraded(self) -> None:
        thin = rank((self._neighbour("a", "CX.ELEC.BATTERY_FAILED", 0.3, 1.0),), "type")
        assert thin.degraded is True

    def test_enough_evidence_at_type_level_is_not_degraded(self) -> None:
        neighbours = tuple(
            self._neighbour(f"C-{i}", "CX.ELEC.BATTERY_FAILED", 0.9, 1.0) for i in range(4)
        )
        assert sum(n.vote for n in neighbours) > DEGRADED_EVIDENCE_MASS
        assert rank(neighbours, "type").degraded is False

    def test_no_neighbours_means_everything_is_other(self) -> None:
        """The only honest answer to "I have never seen this" is to say so."""
        ranking = rank((), "global")
        assert ranking.candidates == ()
        assert ranking.other_probability == 1.0
        assert ranking.degraded is True

    def test_a_cause_the_machine_cannot_have_is_not_offered(self) -> None:
        """A chiller water pump seal is not a possible cause of an aerial platform fault."""
        neighbours = (
            self._neighbour("C-49511", "CH.WATER.PUMP_SEAL_FAILED", 0.7, 1.0),
            self._neighbour("C-48604", "AP.HYD.BOOM_CYL_ROD_SEAL", 0.5, 1.0),
        )
        ranking = rank(neighbours, "family", equipment_family="Aerial Platform AP")
        assert [c.cause_id for c in ranking.candidates] == ["AP.HYD.BOOM_CYL_ROD_SEAL"]

    def test_the_mass_of_a_ruled_out_cause_moves_to_other(self) -> None:
        """Dropping it from the list must not quietly redistribute its vote upward."""
        neighbours = (
            self._neighbour("C-49511", "CH.WATER.PUMP_SEAL_FAILED", 0.7, 1.0),
            self._neighbour("C-48604", "AP.HYD.BOOM_CYL_ROD_SEAL", 0.5, 1.0),
        )
        unfiltered = rank(neighbours, "family")
        filtered = rank(neighbours, "family", equipment_family="Aerial Platform AP")
        boom = next(c for c in unfiltered.candidates if c.cause_id == "AP.HYD.BOOM_CYL_ROD_SEAL")
        assert filtered.candidates[0].probability == pytest.approx(boom.probability)
        assert filtered.other_probability > unfiltered.other_probability
        total = sum(c.probability for c in filtered.candidates) + filtered.other_probability
        assert total == pytest.approx(1.0, abs=1e-9)

    def test_every_candidate_carries_the_cases_it_rests_on(self) -> None:
        neighbours = (
            self._neighbour("C-48211", "CX.ELEC.CONTACTOR_FAILED", 0.7, 1.0),
            self._neighbour("C-48377", "CX.ELEC.CONTACTOR_FAILED", 0.6, 1.0),
        )
        ranking = rank(neighbours, "type")
        assert ranking.candidates[0].evidence_case_ids == ("C-48211", "C-48377")


class TestQuestions:
    def test_a_question_the_user_already_answered_is_not_asked(self, index: CaseIndex) -> None:
        """The description said "no error codes". Asking about codes wastes the turn."""
        text = "Machine overheats under load. No error codes displayed on the panel."
        result = index.search(text, "Air Compressor CX", "CX-450")
        ranking = rank(result.neighbours, result.fallback_level)
        question = next_question(ranking, result.neighbours, extract_features(text), [])
        assert question is None or question.question_id != "error_code"

    def test_a_leak_description_is_asked_something_that_separates_the_leak_causes(
        self, index: CaseIndex
    ) -> None:
        text = "Leak from the boom cylinder"
        result = index.search(text, "Aerial Platform AP", "AP-120")
        ranking = rank(result.neighbours, result.fallback_level)
        question = next_question(ranking, result.neighbours, extract_features(text), [])
        assert question is not None
        assert question.question_id in {"severity", "fluid_type", "onset", "recurrence"}
        assert question.expected_information_gain > 0

    def test_questions_already_asked_are_not_repeated(self, index: CaseIndex) -> None:
        text = "Leak from the boom cylinder"
        result = index.search(text, "Aerial Platform AP", "AP-120")
        ranking = rank(result.neighbours, result.fallback_level)
        asked = [template.question_id for template in TEMPLATES]
        assert next_question(ranking, result.neighbours, extract_features(text), asked) is None

    def test_no_candidates_means_no_question(self) -> None:
        """With nothing to discriminate between, a question cannot gain anything."""
        empty = rank((), "global")
        assert next_question(empty, (), extract_features("something odd"), []) is None

    def test_the_chooser_picks_the_question_that_separates_the_leading_causes(
        self, index: CaseIndex
    ) -> None:
        """Which question is chosen, not merely that one is. The chiller leak causes differ
        on how fast the fluid comes out, and the dispatcher already said what the fluid is,
        so severity is the question worth the turn."""
        text = "Customer says there is oil under the machine"
        result = index.search(text, "Water Chiller CH", None)
        ranking = rank(
            result.neighbours, result.fallback_level, equipment_family="Water Chiller CH"
        )
        question = next_question(ranking, result.neighbours, extract_features(text), [])
        assert question is not None
        assert question.question_id == "severity"
        assert question.expected_information_gain > 0

    def test_a_high_enough_floor_stops_every_question(
        self, index: CaseIndex, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The floor is what stops the interview, so it has to be load-bearing."""
        text = "Leak from the boom cylinder"
        result = index.search(text, "Aerial Platform AP", "AP-120")
        ranking = rank(result.neighbours, result.fallback_level)
        monkeypatch.setattr(questions, "MIN_INFORMATION_GAIN_BITS", 10.0)
        assert next_question(ranking, result.neighbours, extract_features(text), []) is None

    def test_every_answer_a_user_can_give_feeds_back_through_normalisation(
        self, index: CaseIndex
    ) -> None:
        """Every button must set the feature its question is about."""
        result = index.search("Overheating and a rattling noise", "Air Compressor CX", "CX-450")
        for template in TEMPLATES:
            options = template.options
            if template.specialise is not None:
                specialised = template.specialise(result.neighbours)
                assert specialised is not None, "expected the corpus to supply a code"
                options = specialised.options
            for option in options:
                combined = extract_features(f"boom cylinder issue. {option.value}")
                assert template.value_of(combined) is not None, option.value

    def test_the_code_question_names_the_code_the_candidates_actually_print(
        self, index: CaseIndex
    ) -> None:
        """ "Is a code shown?" is a wasted turn. "Does it show E207?" is a probe."""
        result = index.search(
            "Overheating after 20 minutes with a rattle", "Air Compressor CX", "CX-450"
        )
        template = next(t for t in TEMPLATES if t.question_id == "error_code")
        assert template.specialise is not None
        specialised = template.specialise(result.neighbours)
        assert specialised is not None
        assert "E207" in specialised.prompt
        assert any("E207" in option.value for option in specialised.options)
        # The values the gain is scored on name the code too. Scored as generic
        # present/absent, two causes that both always show a code look identical and the
        # one probe that separates them scores zero.
        assert specialised.values[0] == "E207"
