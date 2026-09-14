"""The two Bedrock response parsers, against fakes.

Neither path is reachable from the rest of the suite: the tests inject doubles for the whole
extractor and the whole embedding, so the code that reads what Bedrock actually returns --
the half most likely to break on a model or SDK change -- had no coverage at all. These
fakes stand in for the client, not for the parser, so the parsing is what is tested.
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from pydantic import ValidationError

from diagnostic_assist import similarity as similarity_module
from diagnostic_assist.errors import UpstreamError
from diagnostic_assist.extractor import BedrockLabelExtractor
from diagnostic_assist.models import Case
from diagnostic_assist.similarity import BedrockEmbedding

pytest.importorskip("botocore", reason="the parsers only run when the bedrock extra is installed")


def _case() -> Case:
    return Case(
        case_id="C-00001",
        equipment_family="Air Compressor CX",
        equipment_type="CX-450",
        created_at="2026-01-01T00:00:00Z",
        language="en",
        customer_description="Will not start.",
        technician_notes="Main contactor coil open, swapped it.",
        parts_replaced=("CONTACTOR-M1",),
        resolution_text="Replaced main contactor.",
    )


def _converse(blocks: list[dict[str, Any]], usage: dict[str, int] | None = None) -> Any:
    class FakeClient:
        def converse(self, **_: Any) -> dict[str, Any]:
            return {
                "output": {"message": {"content": blocks}},
                "stopReason": "tool_use",
                "usage": usage or {"inputTokens": 600, "outputTokens": 40},
            }

    extractor = BedrockLabelExtractor()
    extractor._client = FakeClient()
    return extractor


_TOOL_USE = {
    "toolUse": {
        "input": {
            "cause_id": "CX.ELEC.CONTACTOR_FAILED",
            "confidence": 0.9,
            "evidence_spans": ["Main contactor coil open"],
        }
    }
}


class TestExtractorParsing:
    def test_a_tool_call_is_read_and_the_tokens_are_counted(self) -> None:
        extractor = _converse([_TOOL_USE])
        label = extractor.extract(_case())
        assert label.cause_id == "CX.ELEC.CONTACTOR_FAILED"
        assert (extractor.input_tokens, extractor.output_tokens) == (600, 40)

    def test_prose_instead_of_a_tool_call_is_an_error_not_a_label(self) -> None:
        """The tool call is forced. If one is missing, something is wrong upstream."""
        with pytest.raises(RuntimeError):
            _converse([{"text": "I think it is the contactor."}]).extract(_case())

    def test_an_answer_beside_an_abstention_is_read_as_the_answer(self) -> None:
        """Nova returns two tool calls on some cases: a committed answer and an abstention.
        The confidences say which is which, so position is not what decides it."""
        abstention = {
            "toolUse": {"input": {"cause_id": None, "confidence": 0.05, "evidence_spans": []}}
        }
        # The abstention first, which is the order the old take-the-first rule would have lost on.
        label = _converse([abstention, _TOOL_USE]).extract(_case())
        assert label.cause_id == "CX.ELEC.CONTACTOR_FAILED"

    def test_two_causes_at_the_same_confidence_cannot_be_resolved(self) -> None:
        """Choosing between them would be the repair this pipeline refuses to do."""
        other = {
            "toolUse": {
                "input": {
                    "cause_id": "CX.COOL.INTAKE_BLOCKED",
                    "confidence": 0.9,
                    "evidence_spans": ["Main contactor coil open"],
                }
            }
        }
        with pytest.raises(RuntimeError, match="no most-confident answer"):
            _converse([_TOOL_USE, other]).extract(_case())

    def test_a_malformed_payload_is_a_validation_error(self) -> None:
        bad = {"toolUse": {"input": {"cause_id": 123, "confidence": 0.9, "evidence_spans": []}}}
        with pytest.raises(ValidationError):
            _converse([bad]).extract(_case())

    def test_a_client_failure_is_an_upstream_error_not_a_runtime_one(self) -> None:
        """label_case swallows RuntimeError into the review queue; an outage must not go there."""
        from botocore.exceptions import ClientError

        class Boom:
            def converse(self, **_: Any) -> dict[str, Any]:
                raise ClientError({"Error": {"Code": "AccessDenied"}}, "Converse")

        extractor = BedrockLabelExtractor()
        extractor._client = Boom()
        with pytest.raises(UpstreamError):
            extractor.extract(_case())


class _FakeBody:
    def __init__(self, payload: dict[str, Any]) -> None:
        self._payload = payload

    def read(self) -> bytes:
        return json.dumps(self._payload).encode("utf-8")


def _embedding(payload: dict[str, Any]) -> BedrockEmbedding:
    class FakeClient:
        def invoke_model(self, **_: Any) -> dict[str, Any]:
            return {"body": _FakeBody(payload)}

    embedding = BedrockEmbedding()
    embedding._client = FakeClient()
    return embedding


@pytest.fixture(autouse=True)
def _clear_caches() -> None:
    similarity_module._CACHE.clear()
    similarity_module._QUERY_CACHE.clear()


class TestEmbeddingParsing:
    @pytest.mark.parametrize(
        "payload",
        [
            {"embeddings": {"float": [[0.1, 0.2, 0.3, 0.4]]}},  # v4 shape
            {"embeddings": [[0.1, 0.2, 0.3, 0.4]]},  # older bare-list shape
        ],
    )
    def test_both_response_shapes_give_the_same_vector(self, payload: dict[str, Any]) -> None:
        embedding = _embedding(payload)
        embedding.fit(["one document"])
        assert embedding._vectors == [(0.1, 0.2, 0.3, 0.4)]

    def test_a_client_failure_is_an_upstream_error(self) -> None:
        from botocore.exceptions import ClientError

        class Boom:
            def invoke_model(self, **_: Any) -> dict[str, Any]:
                raise ClientError({"Error": {"Code": "AccessDenied"}}, "InvokeModel")

        embedding = BedrockEmbedding()
        embedding._client = Boom()
        with pytest.raises(UpstreamError):
            embedding.fit(["one document"])

    def test_the_query_cache_is_bounded_and_the_document_cache_is_not(self) -> None:
        """Queries are whatever anyone types, so they cannot be kept for the life of the process."""
        from diagnostic_assist.config import QUERY_EMBEDDING_CACHE_SIZE

        embedding = _embedding({"embeddings": {"float": [[0.1, 0.2, 0.3, 0.4]]}})
        embedding.fit(["one document"])
        for i in range(QUERY_EMBEDDING_CACHE_SIZE + 44):
            embedding.scores(f"query number {i}", [0])
        assert len(similarity_module._QUERY_CACHE) == QUERY_EMBEDDING_CACHE_SIZE
        assert len(similarity_module._CACHE) == 1
