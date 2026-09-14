"""The labelling traps. Each test is one way this corpus poisons a naive labeller."""

from __future__ import annotations

from diagnostic_assist.config import (
    EVIDENCE_WEIGHT_CONFIRMED,
    EVIDENCE_WEIGHT_EXCLUDED,
    EVIDENCE_WEIGHT_PROVISIONAL,
)
from diagnostic_assist.extractor import LabelExtractor
from diagnostic_assist.labeling import label_case
from diagnostic_assist.models import Case, CaseLabel, ExtractedLabel, LabelFlag, OutcomeStatus

from .stubs import StubExtractor


class TestCasesThatAreNotDiagnoses:
    def test_c49118_billing_dispute_is_non_technical_and_never_votes(
        self, labels: dict[str, CaseLabel]
    ) -> None:
        """A customer arguing about an invoice is a closed case with no fault in it."""
        label = labels["C-49118"]
        assert label.outcome_status is OutcomeStatus.NON_TECHNICAL
        assert label.cause_id is None
        assert label.evidence_weight == EVIDENCE_WEIGHT_EXCLUDED

    def test_c49203_warranty_whole_unit_swap_is_non_diagnostic_despite_the_part(
        self, labels: dict[str, CaseLabel]
    ) -> None:
        """The single clearest reason parts cannot be the label."""
        label = labels["C-49203"]
        assert label.outcome_status is OutcomeStatus.NON_DIAGNOSTIC
        assert label.cause_id is None
        assert LabelFlag.WHOLE_UNIT_SWAP in label.flags
        assert label.evidence_weight == EVIDENCE_WEIGHT_EXCLUDED

    def test_c49301_no_fault_found(self, labels: dict[str, CaseLabel]) -> None:
        """Intermittent cold-start fault, nothing reproduced on site."""
        label = labels["C-49301"]
        assert label.outcome_status is OutcomeStatus.NO_FAULT_FOUND
        assert label.cause_id is None
        assert label.evidence_weight == EVIDENCE_WEIGHT_EXCLUDED

    def test_c48712_no_oil_leak_found_does_not_become_no_fault_found(
        self, labels: dict[str, CaseLabel]
    ) -> None:
        """"No oil leak found" is a finding, not a non-finding."""
        assert labels["C-48712"].outcome_status is OutcomeStatus.CONFIRMED


class TestTemporaryAndIncompleteWork:
    def test_c48801_temporary_fix_with_null_resolution_is_provisional_and_low_weight(
        self, labels: dict[str, CaseLabel]
    ) -> None:
        """Sealant, a seal kit on order, customer to rebook, `resolution_text: null`."""
        label = labels["C-48801"]
        assert label.outcome_status is OutcomeStatus.PROVISIONAL
        assert label.evidence_weight == EVIDENCE_WEIGHT_PROVISIONAL
        assert LabelFlag.TEMPORARY_FIX in label.flags
        assert LabelFlag.NULL_RESOLUTION in label.flags

    def test_c48801_keeps_the_provisional_cause(self, labels: dict[str, CaseLabel]) -> None:
        """A quarter vote for the right cause beats no vote at all."""
        assert labels["C-48801"].cause_id == "AP.HYD.BOOM_CYL_ROD_SEAL"


class TestFixesWithoutParts:
    def test_c48590_ground_strap_retorqued_with_no_part_replaced(
        self, labels: dict[str, CaseLabel]
    ) -> None:
        """`parts_replaced: []` and a completely diagnosed, fixed machine."""
        label = labels["C-48590"]
        assert label.cause_id == "CX.ELEC.GROUND_STRAP_LOOSE"
        assert label.outcome_status is OutcomeStatus.CONFIRMED
        assert LabelFlag.NO_PART_FIX in label.flags
        assert label.evidence_weight == EVIDENCE_WEIGHT_CONFIRMED

    def test_c48934_intake_screen_cleaned_with_no_part_replaced(
        self, labels: dict[str, CaseLabel]
    ) -> None:
        label = labels["C-48934"]
        assert label.cause_id == "CX.COOL.INTAKE_BLOCKED"
        assert label.outcome_status is OutcomeStatus.CONFIRMED
        assert LabelFlag.NO_PART_FIX in label.flags


class TestCustomerContradictsTechnician:
    def test_c48712_customer_said_oil_but_it_was_condensate(
        self, labels: dict[str, CaseLabel]
    ) -> None:
        """The customer reported a puddle of oil. It was water off the drain pan."""
        label = labels["C-48712"]
        assert label.cause_id == "CH.DRAIN.CONDENSATE_BLOCKED"
        assert LabelFlag.CUSTOMER_SYMPTOM_MISMATCH in label.flags

    def test_c48604_customer_and_technician_agree_so_no_mismatch_flag(
        self, labels: dict[str, CaseLabel]
    ) -> None:
        """The flag has to be rare, or it means nothing."""
        assert LabelFlag.CUSTOMER_SYMPTOM_MISMATCH not in labels["C-48604"].flags


class TestSeverityChangesTheCause:
    def test_c48604_drip_and_c48755_continuous_leak_map_to_different_causes(
        self, labels: dict[str, CaseLabel]
    ) -> None:
        """Same machine family, same component, same fluid. Different job."""
        assert labels["C-48604"].cause_id == "AP.HYD.BOOM_CYL_ROD_SEAL"
        assert labels["C-48755"].cause_id == "AP.HYD.BOOM_CYL_SCORED"


class TestMultilingual:
    def test_c48377_german_case_labels_the_same_as_c48211_english(
        self, labels: dict[str, CaseLabel]
    ) -> None:
        """"Hauptschuetz defekt" and "Main contactor coil open" are one cause."""
        german, english = labels["C-48377"], labels["C-48211"]
        assert german.cause_id == english.cause_id == "CX.ELEC.CONTACTOR_FAILED"
        assert german.outcome_status is english.outcome_status

    def test_c49266_italian_case_labels_the_same_as_c48899_english(
        self, labels: dict[str, CaseLabel]
    ) -> None:
        assert labels["C-49266"].cause_id == labels["C-48899"].cause_id

    def test_c49480_german_case_labels_the_same_as_c49402_english(
        self, labels: dict[str, CaseLabel]
    ) -> None:
        assert labels["C-49480"].cause_id == labels["C-49402"].cause_id


class TestValidationRejectsBadExtraction:
    def test_a_cause_id_outside_the_taxonomy_is_flagged_unmapped(
        self, cases: dict[str, Case]
    ) -> None:
        """The model inventing a plausible id is the failure that scales worst."""
        extractor = StubExtractor(
            {"C-48211": ExtractedLabel(cause_id="CX.ELEC.MADE_UP", confidence=0.99)}
        )
        label = label_case(cases["C-48211"], extractor)
        assert LabelFlag.UNMAPPED in label.flags
        assert label.cause_id is None
        assert label.evidence_weight == EVIDENCE_WEIGHT_EXCLUDED
        assert label.confidence <= 0.2

    def test_an_evidence_span_that_is_not_in_the_case_text_is_flagged_unmapped(
        self, cases: dict[str, Case]
    ) -> None:
        """A model that cannot quote the case did not read the case."""
        extractor = StubExtractor(
            {
                "C-48211": ExtractedLabel(
                    cause_id="CX.ELEC.CONTACTOR_FAILED",
                    confidence=0.99,
                    evidence_spans=("compressor head gasket blown",),
                )
            }
        )
        label = label_case(cases["C-48211"], extractor)
        assert LabelFlag.UNMAPPED in label.flags
        assert LabelFlag.EVIDENCE_NOT_IN_TEXT in label.flags
        assert label.evidence_weight == EVIDENCE_WEIGHT_EXCLUDED

    def test_a_cause_from_the_wrong_equipment_family_is_flagged_unmapped(
        self, cases: dict[str, Case]
    ) -> None:
        """A chiller cause on an air compressor is not a close miss, it is nonsense."""
        extractor = StubExtractor(
            {
                "C-48211": ExtractedLabel(
                    cause_id="CH.WATER.PUMP_SEAL_FAILED",
                    confidence=0.88,
                    evidence_spans=("No power to panel",),
                )
            }
        )
        label = label_case(cases["C-48211"], extractor)
        assert LabelFlag.UNMAPPED in label.flags

    def test_a_part_belonging_to_another_cause_contradicts_the_label(
        self, cases: dict[str, Case]
    ) -> None:
        """Parts cannot establish a cause. They can still refute one."""
        extractor = StubExtractor(
            {
                "C-48211": ExtractedLabel(
                    cause_id="CX.ELEC.BATTERY_FAILED",
                    confidence=0.8,
                    evidence_spans=("No power to panel",),
                )
            }
        )
        label = label_case(cases["C-48211"], extractor)
        assert LabelFlag.UNMAPPED in label.flags
        assert LabelFlag.PART_CAUSE_CONTRADICTION in label.flags

    def test_an_uncatalogued_part_is_not_treated_as_a_contradiction(
        self, cases: dict[str, Case]
    ) -> None:
        """Most part numbers in a 100k corpus are not in a 14-entry taxonomy."""
        case = cases["C-48211"].model_copy(update={"parts_replaced": ("CONSUMABLE-XYZ",)})
        extractor = StubExtractor(
            {
                "C-48211": ExtractedLabel(
                    cause_id="CX.ELEC.CONTACTOR_FAILED",
                    confidence=0.9,
                    evidence_spans=("Main contactor coil open",),
                )
            }
        )
        label = label_case(case, extractor)
        assert LabelFlag.UNMAPPED not in label.flags
        assert LabelFlag.PART_CAUSE_CONTRADICTION not in label.flags

    def test_low_extractor_confidence_is_demoted_rather_than_trusted(
        self, cases: dict[str, Case]
    ) -> None:
        extractor = StubExtractor(
            {
                "C-48211": ExtractedLabel(
                    cause_id="CX.ELEC.CONTACTOR_FAILED",
                    confidence=0.4,
                    evidence_spans=("Main contactor coil open",),
                )
            }
        )
        label = label_case(cases["C-48211"], extractor)
        assert label.outcome_status is OutcomeStatus.PROVISIONAL
        assert label.evidence_weight == EVIDENCE_WEIGHT_PROVISIONAL


class TestCorpusWide:
    def test_every_confirmed_label_carries_evidence_from_the_case_text(
        self, labels: dict[str, CaseLabel]
    ) -> None:
        confirmed = [
            label for label in labels.values() if label.outcome_status is OutcomeStatus.CONFIRMED
        ]
        assert confirmed
        assert all(label.evidence_spans for label in confirmed)

    def test_every_label_pins_the_taxonomy_version(self, labels: dict[str, CaseLabel]) -> None:
        """A label without a version is a label nobody can re-interpret later."""
        assert all(label.taxonomy_version == "2026-09-seed" for label in labels.values())

    def test_only_confirmed_and_provisional_cases_carry_any_weight(
        self, labels: dict[str, CaseLabel]
    ) -> None:
        for label in labels.values():
            if label.outcome_status in (OutcomeStatus.CONFIRMED, OutcomeStatus.PROVISIONAL):
                continue
            assert label.evidence_weight == EVIDENCE_WEIGHT_EXCLUDED

    def test_the_sample_corpus_produces_no_unmapped_labels(
        self, labels: dict[str, CaseLabel]
    ) -> None:
        """A tripwire, not a target."""
        assert [
            label.case_id for label in labels.values() if LabelFlag.UNMAPPED in label.flags
        ] == []

    def test_a_low_confidence_label_reaches_the_review_queue(self, cases: dict[str, Case]) -> None:
        """Validation passing is not the same as the label being worth acting on."""
        extractor = StubExtractor(
            {
                "C-48211": ExtractedLabel(
                    cause_id="CX.ELEC.CONTACTOR_FAILED",
                    confidence=0.3,
                    evidence_spans=("Main contactor coil open",),
                )
            }
        )
        label = label_case(cases["C-48211"], extractor)
        assert LabelFlag.UNMAPPED not in label.flags
        assert label.needs_review is True

    def test_a_confident_validated_label_does_not(self, labels: dict[str, CaseLabel]) -> None:
        assert labels["C-48211"].needs_review is False

    def test_labelling_is_deterministic(
        self, cases: dict[str, Case], extractor: LabelExtractor
    ) -> None:
        first = {cid: label_case(case, extractor) for cid, case in cases.items()}
        second = {cid: label_case(case, extractor) for cid, case in cases.items()}
        assert first == second
