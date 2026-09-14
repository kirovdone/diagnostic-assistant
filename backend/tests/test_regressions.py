"""Bugs found by review, each pinned so it cannot come back."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from diagnostic_assist.api import _sessions, app
from diagnostic_assist.labeling import label_case
from diagnostic_assist.models import Case, ExtractedLabel, LabelFlag, OutcomeStatus
from diagnostic_assist.normalize import extract_error_codes, extract_features

from .stubs import StubExtractor


class TestNegationScope:
    @pytest.mark.parametrize(
        "text",
        [
            "Keine Anzeige am Display, Fehler E-207 im Speicher.",
            "La machine ne demarre pas, code E-207 affiche a l'ecran.",
            "La macchina non parte, codice E207 sul display.",
            "Unit will not restart, E-207 on the panel.",
            "No lights on the control panel, error code E-207 displayed.",
        ],
    )
    def test_a_denial_before_a_comma_does_not_swallow_the_code_after_it(self, text: str) -> None:
        """The denial is about the first clause, the code is in the second."""
        features = extract_features(text)
        assert features.error_codes == ("E207",)
        assert features.error_codes_absent is False

    def test_an_explicit_absence_still_reads_as_absence(self) -> None:
        features = extract_features("No error codes displayed on the panel.")
        assert features.error_codes == ()
        assert features.error_codes_absent is True


class TestFabricatedCodes:
    @pytest.mark.parametrize(
        "text",
        [
            "CO2 leak detected at the fitting.",
            "DN25 pipe joint weeping.",
            "IP54 enclosure, water ingress.",
            "LED 3 flashing on the board.",
            "UNIT RAN 40 MIN THEN TRIPPED.",
            "Cleared the error. 45 min test run, no repeat.",
            "Site access code 4471 given by customer.",
            "La temperatura e 45 gradi in mandata.",
        ],
    )
    def test_ordinary_text_does_not_become_a_fault_code(self, text: str) -> None:
        """An invented code is worse than a missed one."""
        assert extract_error_codes(text)[0] == ()

    def test_the_codes_the_corpus_really_contains_still_extract(self) -> None:
        assert extract_error_codes("Panel shows LP-01.")[0] == ("LP-01",)
        assert extract_error_codes("showing E-207")[0] == ("E207",)
        assert extract_error_codes("Display flashed err 207 once")[0] == ("E207",)

    def test_a_sentence_boundary_survives_normalisation(self) -> None:
        """`error. 45` became `e45`, silently welding two sentences together."""
        assert "e45" not in extract_features("Cleared the error. 45 min test run.").normalized_text


class TestCuesMatchWholeWords:
    @pytest.mark.parametrize(
        ("text", "field", "expected"),
        [
            # `condensa` (Italian condensate) inside `condensateur`, a start capacitor.
            ("Condensateur de demarrage defectueux.", "fluid_claimed", "unknown"),
            ("Condensatore sporco, alta pressione.", "fluid_claimed", "unknown"),
            # `ol` (folded German `Öl`) inside `old`.
            ("Old seal on the boom cylinder.", "fluid_claimed", "unknown"),
            # `again` inside `against`.
            ("Belt rubbing against the guard.", "recurrence", "unknown"),
            # `drop` inside `dropped`, which is a reading and not a leak.
            ("Voltage dropped to 180V at the terminals.", "severity", "unknown"),
            # `continue` inside a sentence about what the customer will do next.
            ("Customer will continue to monitor the machine.", "severity", "unknown"),
            # `spray` inside `sprayed`, which is a leak test and not a symptom.
            ("Sprayed soapy water on the fittings, no bubbles.", "severity", "unknown"),
        ],
    )
    def test_a_cue_does_not_fire_inside_an_unrelated_word(
        self, text: str, field: str, expected: str
    ) -> None:
        assert getattr(extract_features(text), field) == expected

    def test_the_real_cues_still_fire(self) -> None:
        assert extract_features("puddle of oil under the machine").fluid_claimed == "oil"
        assert extract_features("Water spraying from the hot side").severity == "continuous"
        assert extract_features("approx 1 drop per minute").severity == "drip"
        assert extract_features("Battery dead again, third time").recurrence == "yes"


class TestNegatedFeatures:
    @pytest.mark.parametrize(
        "text",
        [
            "No oil leak found under the machine.",
            "Kein Oelverlust festgestellt.",
            "Pas de fuite d'huile.",
        ],
    )
    def test_a_denied_fluid_is_not_a_claimed_fluid(self, text: str) -> None:
        """Reading a denial as a claim manufactures the mismatch we exist to detect."""
        assert extract_features(text).fluid_claimed == "unknown"

    def test_a_denied_severity_is_not_a_claimed_severity(self) -> None:
        assert extract_features("No puddle, just a slow drip at the fitting.").severity == "drip"

    @pytest.mark.parametrize(
        "text",
        [
            "This is not the first time it has happened.",
            "Ce n'est pas la premiere fois que ca arrive.",
            "Non e la prima volta che succede.",
        ],
    )
    def test_a_denied_denial_does_not_invert(self, text: str) -> None:
        """ "Not the first time" means it recurred. It was being recorded as "no"."""
        assert extract_features(text).recurrence != "no"

    def test_cold_water_plumbing_is_not_a_cold_start_fault(self) -> None:
        """C-49544's "cold water side" is a circuit, not the machine's temperature."""
        features = extract_features("Slow water drip on the cold water side of the machine.")
        assert "cold" not in features.onset_conditions

    def test_a_genuine_cold_start_still_reads(self) -> None:
        text = "Machine won't start, happens most mornings when it is cold."
        assert "cold" in extract_features(text).onset_conditions


def _case(**overrides: object) -> Case:
    base = {
        "case_id": "C-TEST",
        "equipment_family": "Air Compressor CX",
        "equipment_type": "CX-450",
        "created_at": "2026-01-14T08:22:00Z",
        "language": "en",
        "customer_description": "Unit won't start at all.",
        "technician_notes": "Main contactor coil open. Swapped contactor, unit runs.",
        "parts_replaced": ("CONTACTOR-M1",),
        "resolution_text": "Replaced main contactor.",
    }
    return Case.model_validate({**base, **overrides})


def _extractor(**overrides: object) -> StubExtractor:
    return StubExtractor(
        {
            "C-TEST": ExtractedLabel.model_validate(
                {
                    "cause_id": "CX.ELEC.CONTACTOR_FAILED",
                    "confidence": 0.9,
                    "evidence_spans": ("Main contactor coil open",),
                    **overrides,
                }
            )
        }
    )


class TestPreChecksDoNotOverreach:
    def test_manufacturer_does_not_make_a_case_non_technical(self) -> None:
        """`facture` as a bare substring occurs inside `manufacturer`."""
        case = _case(
            technician_notes="Main contactor coil open. Fitted manufacturer-approved contactor."
        )
        label = label_case(case, _extractor())
        assert label.outcome_status is OutcomeStatus.CONFIRMED

    def test_berechnung_does_not_make_a_case_non_technical(self) -> None:
        case = _case(
            technician_notes=(
                "Berechnung des Lagerspiels: 0.12 mm. Main contactor coil open, swapped it."
            )
        )
        assert label_case(case, _extractor()).outcome_status is OutcomeStatus.CONFIRMED

    def test_no_fault_found_scoped_to_one_subsystem_keeps_the_diagnosis(self) -> None:
        """A finding about the contactor is not a finding about the machine."""
        case = _case(
            technician_notes=(
                "No fault found in the panel wiring. Main contactor coil open, swapped it."
            )
        )
        assert label_case(case, _extractor()).outcome_status is OutcomeStatus.CONFIRMED

    def test_an_unqualified_no_fault_found_is_still_terminal(self) -> None:
        case = _case(
            technician_notes="Ran 30 min without fault.", resolution_text="No fault found."
        )
        label = label_case(case, _extractor())
        assert label.outcome_status is OutcomeStatus.NO_FAULT_FOUND
        assert label.cause_id is None

    def test_the_german_whole_unit_swap_is_caught_in_either_spelling(self) -> None:
        """`normalize_text` folds the umlaut, so the ae-only pattern matched the sloppy"""
        for spelling in ("Komplettgerät getauscht", "Komplettgeraet getauscht"):
            case = _case(
                technician_notes=f"Geraet innerhalb der Garantie. {spelling}, nicht zerlegt.",
                resolution_text=f"{spelling}.",
                parts_replaced=(),
            )
            label = label_case(case, _extractor())
            assert label.outcome_status is OutcomeStatus.NON_DIAGNOSTIC, spelling
            assert LabelFlag.WHOLE_UNIT_SWAP in label.flags

    def test_a_completed_repair_that_used_sealant_is_not_provisional(self) -> None:
        """`sealant` alone quartered the evidence weight of a finished job."""
        case = _case(
            technician_notes=(
                "Main contactor coil open. Applied sealant to the joint and replaced it. Tested OK."
            ),
            resolution_text="Contactor replaced.",
        )
        assert label_case(case, _extractor()).outcome_status is OutcomeStatus.CONFIRMED

    def test_a_unit_prefixed_component_does_not_zero_a_diagnosed_case(self) -> None:
        """Parts never establish anything, including a whole-unit swap."""
        case = _case(parts_replaced=("UNIT-FILTER-CX", "CONTACTOR-M1"))
        assert label_case(case, _extractor()).outcome_status is OutcomeStatus.CONFIRMED

    def test_a_real_warranty_swap_is_still_caught_by_its_part(self) -> None:
        case = _case(
            technician_notes="Unit within warranty, swapped per policy, did not strip down.",
            parts_replaced=("UNIT-CX450",),
        )
        label = label_case(case, _extractor())
        assert label.outcome_status is OutcomeStatus.NON_DIAGNOSTIC
        assert LabelFlag.WHOLE_UNIT_SWAP in label.flags


class TestValidationCannotBeBypassed:
    def test_claiming_a_cause_and_quoting_nothing_fails(self) -> None:
        """Silence was the cheapest way past the span check."""
        case = _case(parts_replaced=())
        label = label_case(case, _extractor(evidence_spans=()))
        assert LabelFlag.UNMAPPED in label.flags
        assert LabelFlag.EVIDENCE_NOT_IN_TEXT in label.flags
        assert label.evidence_weight == 0.0

    def test_a_second_unrelated_part_does_not_reject_a_supported_cause(self) -> None:
        """Technicians fix more than one thing per visit."""
        case = _case(parts_replaced=("CONTACTOR-M1", "BATT-95AH"))
        label = label_case(case, _extractor())
        assert LabelFlag.PART_CAUSE_CONTRADICTION not in label.flags
        assert label.outcome_status is OutcomeStatus.CONFIRMED

    def test_a_cause_with_no_supporting_part_is_still_contradicted(self) -> None:
        case = _case(parts_replaced=("BATT-95AH",))
        label = label_case(case, _extractor())
        assert LabelFlag.PART_CAUSE_CONTRADICTION in label.flags


class TestEquipmentAnswerIsNotASymptom:
    """The family name is an English phrase, and its words are also symptom cues."""

    def test_answering_which_machine_does_not_change_the_symptoms(self) -> None:
        client = _signed_in()
        created = client.post(
            "/sessions", json={"description": "Customer says there is oil under the machine"}
        ).json()
        assert created["question"]["question_id"] == "equipment"
        session_id = created["session_id"]

        before = extract_features(created["description"])
        assert before.fluid_claimed == "oil"

        updated = client.post(
            f"/sessions/{session_id}/answers",
            json={"question_id": "equipment", "value": "Water Chiller CH"},
        ).json()
        assert updated["equipment_family"] == "Water Chiller CH"

        session = _sessions[session_id]
        after = extract_features(session.effective_text())
        assert after.fluid_claimed == "oil"
        # And the consequence the user would have seen: the fluid is known, so the fluid
        # question is not asked.
        assert (updated["question"] or {}).get("question_id") != "fluid_type"

    def test_a_symptom_answer_is_still_appended(self) -> None:
        """The exception is the equipment answer, not answers in general."""
        client = _signed_in()
        created = client.post("/sessions", json={"description": "hyd. lk @ boom cyl"}).json()
        question = created["question"]
        assert question is not None and question["question_id"] != "equipment"
        client.post(
            f"/sessions/{created['session_id']}/answers",
            json={"question_id": question["question_id"], "value": question["options"][0]["value"]},
        )
        session = _sessions[created["session_id"]]
        assert question["options"][0]["value"] in session.effective_text()


def _signed_in() -> TestClient:
    """Every route that touches case data needs a token. See tests/test_auth.py."""
    client = TestClient(app)
    token = client.post(
        "/auth/login", json={"username": "user@test.com", "password": "user"}
    ).json()["token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client


class TestAnswerCorrection:
    def test_correcting_an_answer_keeps_the_question_on_screen(self) -> None:
        """The technician changes their mind and the question they were looking at goes."""
        client = _signed_in()
        created = client.post(
            "/sessions",
            json={
                "equipment_family": "Aerial Platform AP",
                "equipment_type": "AP-120",
                "description": "Leak from the boom cylinder",
            },
        ).json()
        first = created["question"]
        assert first is not None
        url = f"/sessions/{created['session_id']}/answers"

        answered = client.post(
            url, json={"question_id": first["question_id"], "value": first["options"][0]["value"]}
        ).json()
        pending = answered["question"]
        assert pending is not None

        corrected = client.post(
            url, json={"question_id": first["question_id"], "value": first["options"][1]["value"]}
        ).json()
        assert corrected["question"] is not None
        assert corrected["question"]["question_id"] == pending["question_id"]
        assert corrected["status"] == "ACTIVE"

    def test_an_answer_to_a_question_that_was_never_asked_is_rejected(self) -> None:
        """It burned one of three slots and injected arbitrary text into retrieval."""
        client = _signed_in()
        created = client.post(
            "/sessions",
            json={
                "equipment_family": "Water Chiller CH",
                "equipment_type": "CH-200",
                "description": "Water leaking from the machine.",
            },
        ).json()
        response = client.post(
            f"/sessions/{created['session_id']}/answers",
            json={"question_id": "not_a_question", "value": "anything at all"},
        )
        assert response.status_code == 422

    def test_closing_a_session_twice_cannot_overwrite_the_confirmed_cause(self) -> None:
        """The only ground truth the running system produces, and a retry could blank it."""
        client = _signed_in()
        created = client.post(
            "/sessions",
            json={
                "equipment_family": "Aerial Platform AP",
                "equipment_type": "AP-120",
                "description": "Oil dripping from the boom cylinder.",
            },
        ).json()
        url = f"/sessions/{created['session_id']}/close"

        first = client.post(url, json={"confirmed_cause_id": "AP.HYD.BOOM_CYL_ROD_SEAL"})
        assert first.status_code == 200
        assert first.json()["confirmed_cause_id"] == "AP.HYD.BOOM_CYL_ROD_SEAL"

        second = client.post(url, json={"confirmed_cause_id": None})
        assert second.status_code == 409
        assert _sessions[created["session_id"]].confirmed_cause_id == "AP.HYD.BOOM_CYL_ROD_SEAL"

    def test_a_confirmed_cause_outside_the_taxonomy_is_refused(self) -> None:
        """Every accuracy number is computed from this field."""
        client = _signed_in()
        created = client.post(
            "/sessions",
            json={
                "equipment_family": "Water Chiller CH",
                "equipment_type": "CH-200",
                "description": "Water under the machine.",
            },
        ).json()
        url = f"/sessions/{created['session_id']}/close"

        assert client.post(url, json={"confirmed_cause_id": "NOT.A.REAL_CAUSE"}).status_code == 422
        assert _sessions[created["session_id"]].confirmed_cause_id is None
        assert client.post(url, json={"confirmed_cause_id": None}).status_code == 200

    def test_the_close_response_carries_the_sequence_number_the_stream_reached(self) -> None:
        """`_publish` stamps seq after emitting and says why; close did not, so the body"""
        client = _signed_in()
        created = client.post(
            "/sessions",
            json={
                "equipment_family": "Water Chiller CH",
                "equipment_type": "CH-200",
                "description": "Water under the machine.",
            },
        ).json()
        closed = client.post(
            f"/sessions/{created['session_id']}/close", json={"confirmed_cause_id": None}
        ).json()
        assert closed["seq"] == _sessions[created["session_id"]].seq

    def test_reading_a_session_in_another_language_does_not_change_the_session(self) -> None:
        """A GET that persisted its language made a read mutate shared state, so two tabs on"""
        client = _signed_in()
        created = client.post(
            "/sessions",
            json={
                "equipment_family": "Air Compressor CX",
                "equipment_type": "CX-450",
                "description": "Unit will not start.",
                "language": "en",
            },
        ).json()
        sid = created["session_id"]

        german = client.get(f"/sessions/{sid}?language=de").json()
        assert german["language"] == "de"
        assert _sessions[sid].language == "en"
        assert client.get(f"/sessions/{sid}").json()["language"] == "en"

    def test_sessions_past_their_ttl_are_dropped(self) -> None:
        """Two module dicts with no eviction: a session whose browser never opened the stream"""
        from datetime import UTC, datetime, timedelta

        from diagnostic_assist.api import _queues
        from diagnostic_assist.config import SESSION_TTL_SECONDS

        client = _signed_in()
        stale = client.post(
            "/sessions",
            json={
                "equipment_family": "Water Chiller CH",
                "equipment_type": "CH-200",
                "description": "Water under the machine.",
            },
        ).json()["session_id"]

        _sessions[stale].created_at = datetime.now(UTC) - timedelta(
            seconds=SESSION_TTL_SECONDS + 60
        )
        fresh = client.post(
            "/sessions",
            json={
                "equipment_family": "Water Chiller CH",
                "equipment_type": "CH-200",
                "description": "Water under the machine.",
            },
        ).json()["session_id"]

        assert stale not in _sessions
        assert stale not in _queues
        assert fresh in _sessions
        assert client.get(f"/sessions/{stale}").status_code == 404


class TestUpstreamFailures:
    """An unreachable Bedrock is a 503 with a reason, not a 500 with a traceback."""

    def test_a_bedrock_failure_is_a_503_not_a_500(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from botocore.exceptions import ClientError

        from diagnostic_assist import api

        def explode(*_: object, **__: object) -> None:
            raise ClientError({"Error": {"Code": "AccessDenied"}}, "Converse")

        monkeypatch.setattr(api, "_corpus", None)
        monkeypatch.setattr(api, "_Corpus", explode)
        client = TestClient(api.app, raise_server_exceptions=False)
        token = client.post(
            "/auth/login", json={"username": "user@test.com", "password": "user"}
        ).json()["token"]
        response = client.post(
            "/sessions",
            json={"description": "Oil under the machine", "language": "en"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 503
        assert "Bedrock" in response.json()["detail"]
