"""The HTTP surface."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from diagnostic_assist.api import app
from diagnostic_assist.config import MAX_QUESTIONS_PER_SESSION


@pytest.fixture
def client() -> TestClient:
    """Signed in, because every route that touches case data requires a token."""
    signed_out = TestClient(app)
    token = signed_out.post(
        "/auth/login", json={"username": "user@test.com", "password": "user"}
    ).json()["token"]
    signed_out.headers["Authorization"] = f"Bearer {token}"
    return signed_out


@pytest.fixture
def anonymous() -> TestClient:
    return TestClient(app)


def _token(client: TestClient) -> str:
    return str(client.headers["Authorization"]).removeprefix("Bearer ")


def _describe(client: TestClient, description: str) -> dict:
    """Start a session the way the product does: one input, nothing else."""
    response = client.post("/sessions", json={"description": description})
    assert response.status_code == 200
    return response.json()


def _start(client: TestClient, description: str, family: str, type_: str) -> dict:
    response = client.post(
        "/sessions",
        json={
            "equipment_family": family,
            "equipment_type": type_,
            "description": description,
        },
    )
    assert response.status_code == 200
    return response.json()


class TestSessionLifecycle:
    def test_a_new_session_returns_candidates_and_the_evidence_to_judge_them(
        self, client: TestClient
    ) -> None:
        body = _start(
            client,
            "Customer reported a puddle of oil under the machine.",
            "Water Chiller CH",
            "CH-200",
        )
        ranking = body["ranking"]
        assert ranking["candidates"]
        assert ranking["fallback_level"] in ("type", "family", "global")
        assert ranking["n_similar_cases"] > 0
        assert body["taxonomy_version"] == "2026-09-seed"

    def test_probabilities_on_the_wire_include_the_other_share(self, client: TestClient) -> None:
        """The API must not hand the client a list that silently fails to add up."""
        ranking = _start(client, "Water leaking from the machine.", "Water Chiller CH", "CH-200")[
            "ranking"
        ]
        total = sum(c["probability"] for c in ranking["candidates"])
        assert total + ranking["other_probability"] == pytest.approx(1.0, abs=1e-9)

    def test_get_returns_the_same_question_that_was_streamed(self, client: TestClient) -> None:
        """A reconnecting client must not be handed a different question."""
        created = _start(client, "Leak from the boom cylinder", "Aerial Platform AP", "AP-120")
        assert created["question"] is not None
        fetched = client.get(f"/sessions/{created['session_id']}").json()
        assert fetched["question"]["question_id"] == created["question"]["question_id"]
        assert fetched["question"]["prompt"] == created["question"]["prompt"]

    def test_an_unknown_session_is_a_404(self, client: TestClient) -> None:
        assert client.get("/sessions/does-not-exist").status_code == 404


class TestAnswers:
    def test_answering_moves_the_ranking(self, client: TestClient) -> None:
        created = _start(client, "Leak from the boom cylinder", "Aerial Platform AP", "AP-120")
        question = created["question"]
        assert question is not None
        before = created["ranking"]["candidates"][0]["probability"]

        updated = client.post(
            f"/sessions/{created['session_id']}/answers",
            json={"question_id": question["question_id"], "value": question["options"][0]["value"]},
        ).json()
        after = updated["ranking"]["candidates"][0]["probability"]
        assert (after != before) or (
            updated["ranking"]["candidates"][0]["cause_id"]
            != created["ranking"]["candidates"][0]["cause_id"]
        )

    def test_replaying_the_same_answer_is_idempotent(self, client: TestClient) -> None:
        """A retry must not burn one of the three questions or re-emit events."""
        created = _start(client, "Leak from the boom cylinder", "Aerial Platform AP", "AP-120")
        question = created["question"]
        assert question is not None
        payload = {
            "question_id": question["question_id"],
            "value": question["options"][0]["value"],
        }
        url = f"/sessions/{created['session_id']}/answers"

        first = client.post(url, json=payload).json()
        second = client.post(url, json=payload).json()

        assert second["seq"] == first["seq"]
        assert second["answers"] == first["answers"]

    def test_changing_an_answer_re_ranks(self, client: TestClient) -> None:
        created = _start(client, "Leak from the boom cylinder", "Aerial Platform AP", "AP-120")
        question = created["question"]
        assert question is not None
        url = f"/sessions/{created['session_id']}/answers"
        qid = question["question_id"]

        first = client.post(
            url, json={"question_id": qid, "value": question["options"][0]["value"]}
        )
        second = client.post(
            url, json={"question_id": qid, "value": question["options"][1]["value"]}
        )
        assert second.json()["seq"] > first.json()["seq"]
        assert second.json()["answers"][qid] == question["options"][1]["value"]

    def test_the_interview_stops_after_the_configured_number_of_questions(
        self, client: TestClient
    ) -> None:
        """Nobody on a live call answers ten questions."""
        created = _start(client, "Leak from the boom cylinder", "Aerial Platform AP", "AP-120")
        session_id = created["session_id"]
        current = created

        for _ in range(MAX_QUESTIONS_PER_SESSION + 2):
            question = current["question"]
            if question is None:
                break
            current = client.post(
                f"/sessions/{session_id}/answers",
                json={
                    "question_id": question["question_id"],
                    "value": question["options"][0]["value"],
                },
            ).json()

        assert current["question"] is None
        assert len(current["answers"]) <= MAX_QUESTIONS_PER_SESSION


class TestClosing:
    def test_closing_records_the_cause_that_it_actually_was(self, client: TestClient) -> None:
        """The only ground truth the running system ever produces."""
        created = _start(client, "Water leaking from the machine.", "Water Chiller CH", "CH-200")
        closed = client.post(
            f"/sessions/{created['session_id']}/close",
            json={"confirmed_cause_id": "CH.WATER.PUMP_SEAL_FAILED"},
        ).json()
        assert closed["status"] == "CLOSED"
        assert closed["confirmed_cause_id"] == "CH.WATER.PUMP_SEAL_FAILED"
        assert closed["question"] is None

    def test_closing_with_no_cause_is_allowed_and_is_the_most_informative_outcome(
        self, client: TestClient
    ) -> None:
        """ "None of these" is the direct measurement of the "other" share being honest."""
        created = _start(client, "Water leaking from the machine.", "Water Chiller CH", "CH-200")
        closed = client.post(
            f"/sessions/{created['session_id']}/close", json={"confirmed_cause_id": None}
        ).json()
        assert closed["status"] == "CLOSED"
        assert closed["confirmed_cause_id"] is None

    def test_answering_a_closed_session_is_rejected(self, client: TestClient) -> None:
        created = _start(client, "Water leaking from the machine.", "Water Chiller CH", "CH-200")
        client.post(f"/sessions/{created['session_id']}/close", json={})
        response = client.post(
            f"/sessions/{created['session_id']}/answers",
            json={"question_id": "severity", "value": "slow drip"},
        )
        assert response.status_code == 409


class TestStream:
    def test_the_stream_replays_events_queued_before_the_client_connected(
        self, client: TestClient
    ) -> None:
        """POST /sessions returns before the browser can open the stream."""
        created = _start(client, "Machine will not start, no lights", "Air Compressor CX", "CX-450")
        events: list[tuple[str, dict]] = []
        with client.stream(
            "GET", f"/sessions/{created['session_id']}/events?token={_token(client)}"
        ) as response:
            assert response.status_code == 200
            name = ""
            for line in response.iter_lines():
                if line.startswith("event:"):
                    name = line.split(":", 1)[1].strip()
                elif line.startswith("data:"):
                    events.append((name, json.loads(line.split(":", 1)[1].strip())))
                    if name == "done":
                        break

        names = [name for name, _ in events]
        assert names[0] == "candidates.initial"
        assert names[-1] == "done"
        assert all(payload["taxonomy_version"] == "2026-09-seed" for _, payload in events)
        seqs = [payload["seq"] for _, payload in events]
        assert seqs == sorted(seqs)

    def test_a_thin_answer_emits_the_degraded_event(self, client: TestClient) -> None:
        """The UI shows "limited analysis" because the server said so, not because it guessed."""
        created = _start(client, "Strange smell", "Water Chiller CH", "CH-200")
        assert created["ranking"]["degraded"] is True

        names: list[str] = []
        with client.stream(
            "GET", f"/sessions/{created['session_id']}/events?token={_token(client)}"
        ) as response:
            name = ""
            for line in response.iter_lines():
                if line.startswith("event:"):
                    name = line.split(":", 1)[1].strip()
                elif line.startswith("data:"):
                    names.append(name)
                    if name == "done":
                        break
        assert "degraded" in names


class TestOneInput:
    """The product is one field. Everything here starts from a description and nothing else."""

    def test_a_type_code_in_the_description_scopes_the_search(self, client: TestClient) -> None:
        created = _describe(client, "CX-450 will not start, no lights on the panel")
        assert created["equipment_family"] == "Air Compressor CX"
        assert created["equipment_type"] == "CX-450"
        assert created["equipment_basis"] == "TYPE_CODE"
        assert created["ranking"]["candidates"]

    def test_a_part_only_one_machine_has_scopes_the_search(self, client: TestClient) -> None:
        """The common case: the technician names the part, never the asset."""
        created = _describe(client, "hyd. lk @ boom cyl, ~1 drp/min")
        assert created["equipment_family"] == "Aerial Platform AP"
        assert created["equipment_basis"] == "COMPONENT"

    def test_a_description_that_names_no_machine_asks_which_one(self, client: TestClient) -> None:
        """And shows nothing while it does not know."""
        created = _describe(client, "Battery dead again, third time this month")
        assert created["equipment_family"] is None
        assert created["equipment_basis"] is None
        assert created["ranking"]["candidates"] == []
        assert created["ranking"]["other_probability"] == 1.0
        assert created["question"]["question_id"] == "equipment"
        assert [option["value"] for option in created["question"]["options"]] == [
            "Aerial Platform AP",
            "Air Compressor CX",
            "Water Chiller CH",
        ]

    def test_an_ambiguous_description_offers_the_families_it_matched_first(
        self, client: TestClient
    ) -> None:
        created = _describe(client, "boom cylinder leak and the condenser is blocked")
        options = [option["value"] for option in created["question"]["options"]]
        assert options[:2] == ["Aerial Platform AP", "Water Chiller CH"]
        assert set(options) == {"Aerial Platform AP", "Air Compressor CX", "Water Chiller CH"}

    def test_answering_which_machine_scopes_the_session_and_ranks(self, client: TestClient) -> None:
        created = _describe(client, "Battery dead again, third time this month")
        updated = client.post(
            f"/sessions/{created['session_id']}/answers",
            json={"question_id": "equipment", "value": "Air Compressor CX"},
        ).json()
        assert updated["equipment_family"] == "Air Compressor CX"
        assert updated["equipment_basis"] == "STATED"
        assert updated["ranking"]["candidates"]
        assert updated["ranking"]["other_probability"] < 1.0

    def test_the_equipment_answer_is_read_the_same_way_the_description_is(
        self, client: TestClient
    ) -> None:
        """One code path, whether the words came from a button or from a person."""
        created = _describe(client, "it is making a noise")
        updated = client.post(
            f"/sessions/{created['session_id']}/answers",
            json={"question_id": "equipment", "value": "it's the chiller, CH-350"},
        ).json()
        assert updated["equipment_family"] == "Water Chiller CH"
        assert updated["equipment_type"] == "CH-350"

    def test_an_equipment_answer_that_names_nothing_asks_again(self, client: TestClient) -> None:
        """Proceeding on a scope nobody established is the thing this must never do."""
        created = _describe(client, "it is making a noise")
        updated = client.post(
            f"/sessions/{created['session_id']}/answers",
            json={"question_id": "equipment", "value": "the big one out the back"},
        ).json()
        assert updated["equipment_family"] is None
        assert updated["question"]["question_id"] == "equipment"

    def test_asking_which_machine_does_not_spend_a_diagnostic_question(
        self, client: TestClient
    ) -> None:
        """The three-question budget is for symptoms. Scope is not a symptom."""
        created = _describe(client, "Battery dead again, third time this month")
        session_id = created["session_id"]
        current = client.post(
            f"/sessions/{session_id}/answers",
            json={"question_id": "equipment", "value": "Air Compressor CX"},
        ).json()

        asked = 0
        for _ in range(MAX_QUESTIONS_PER_SESSION + 2):
            question = current["question"]
            if question is None:
                break
            asked += 1
            current = client.post(
                f"/sessions/{session_id}/answers",
                json={
                    "question_id": question["question_id"],
                    "value": question["options"][0]["value"],
                },
            ).json()

        assert current["question"] is None
        assert asked <= MAX_QUESTIONS_PER_SESSION

    def test_a_stated_machine_still_wins_over_the_text(self, client: TestClient) -> None:
        """A work order or a QR code on the asset is an assertion; the text is a reading."""
        response = client.post(
            "/sessions",
            json={
                "description": "hyd. lk @ boom cyl",
                "equipment_family": "Water Chiller CH",
                "equipment_type": "CH-350",
            },
        )
        created = response.json()
        assert created["equipment_family"] == "Water Chiller CH"
        assert created["equipment_basis"] == "STATED"


class TestLanguage:
    """The taxonomy already holds a label per language. This is the wire that uses it."""

    def test_the_ranking_comes_back_in_the_language_asked_for(self, client: TestClient) -> None:
        response = client.post(
            "/sessions",
            json={
                "description": "Klopfgeraeusch im Zylinder, wird unter Last lauter",
                "language": "de",
            },
        ).json()
        assert response["equipment_family"] == "Air Compressor CX"
        labels = [candidate["label"] for candidate in response["ranking"]["candidates"]]
        assert "Pleuellager verschlissen" in labels

    def test_a_language_the_taxonomy_does_not_have_falls_back_to_english(
        self, client: TestClient
    ) -> None:
        """The UI ships seven locales; the taxonomy was written for the corpus's four."""
        response = client.post(
            "/sessions",
            json={
                "description": "Klopfgeraeusch im Zylinder, wird unter Last lauter",
                "language": "nl",
            },
        ).json()
        labels = [candidate["label"] for candidate in response["ranking"]["candidates"]]
        assert "Connecting rod bearing worn" in labels

    def test_switching_language_mid_session_moves_the_labels(self, client: TestClient) -> None:
        created = client.post(
            "/sessions",
            json={"description": "Klopfgeraeusch im Zylinder, wird unter Last lauter"},
        ).json()
        english = [c["label"] for c in created["ranking"]["candidates"]]
        assert "Connecting rod bearing worn" in english

        switched = client.get(f"/sessions/{created['session_id']}?language=fr").json()
        french = [c["label"] for c in switched["ranking"]["candidates"]]
        assert "Coussinet de bielle usé" in french


class TestSupportingReads:
    def test_cases_returns_every_case_including_the_excluded_ones(
        self, client: TestClient
    ) -> None:
        """The review page has to show what was thrown away, or it is not a review page."""
        rows = client.get("/cases").json()
        assert len(rows) == 22
        statuses = {row["label"]["outcome_status"] for row in rows}
        assert "NON_TECHNICAL" in statuses
        assert "NON_DIAGNOSTIC" in statuses
        assert "NO_FAULT_FOUND" in statuses

    def test_every_label_row_carries_the_date_the_case_was_closed(self, client: TestClient) -> None:
        """The review queue is filtered by date, so the date has to be on the wire."""
        rows = client.get("/cases").json()
        assert all(row["created_at"] for row in rows)
        dates = sorted(row["created_at"] for row in rows)
        assert dates[0].startswith("2026-01-14")
        assert dates[-1].startswith("2026-03-16")

    def test_a_case_can_be_opened_from_its_evidence_id(self, client: TestClient) -> None:
        body = client.get("/cases/C-48712").json()
        assert body["case_id"] == "C-48712"
        assert "oil" in body["customer_description"].lower()

    def test_equipment_options_come_from_the_corpus(self, client: TestClient) -> None:
        families = client.get("/equipment").json()
        assert "Air Compressor CX" in families
        assert "CX-450" in families["Air Compressor CX"]
