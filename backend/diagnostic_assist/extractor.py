"""The interface labelling uses to ask a model what a case was about, and its impls."""

from __future__ import annotations

from typing import Any, Final, Protocol

from .config import (
    BEDROCK_MAX_ATTEMPTS,
    BEDROCK_MODEL_ID,
    BEDROCK_REGION,
    aws_credentials_available,
)
from .models import Case, ExtractedLabel
from .taxonomy import TAXONOMY_VERSION, all_causes


class LabelExtractor(Protocol):
    """Reads a closed case and claims a root cause. The claim is not yet believed."""

    def extract(self, case: Case) -> ExtractedLabel: ...


def build_prompt(case: Case) -> str:
    """The extraction prompt."""
    catalogue = "\n".join(
        f"- {cause.cause_id}: {cause.label('en')} (typical parts: "
        f"{', '.join(cause.typical_parts) or 'none'})"
        for cause in all_causes()
    )
    return f"""You are labelling a closed field-service case with its root cause.

Taxonomy version {TAXONOMY_VERSION}. Choose exactly one cause_id from this list, or null
if none of them is what the technician actually found:

{catalogue}

Rules:
- The root cause is what the TECHNICIAN found and wrote down. Use technician_notes and
  resolution_text. Ignore parts_replaced entirely: it records what was fitted, which is
  often what was on the van or what the warranty allowed.
- If the technician did not find a cause (no fault found, whole unit swapped, the case is
  not technical), return null. Do not infer a cause from the symptom.
- evidence_spans must be copied character for character out of the case text. Do not
  paraphrase, translate or summarise them.
- confidence is your probability that this cause_id is what the technician found.

Case:
  case_id: {case.case_id}
  equipment_family: {case.equipment_family}
  equipment_type: {case.equipment_type}
  language: {case.language}
  customer_description: {case.customer_description}
  technician_notes: {case.technician_notes}
  resolution_text: {case.resolution_text}

Return JSON: {{"cause_id": string|null, "confidence": number, "evidence_spans": string[]}}
"""


RESPONSE_SCHEMA: Final[dict[str, object]] = {
    "type": "object",
    "properties": {
        "cause_id": {"type": ["string", "null"]},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "evidence_spans": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["cause_id", "confidence", "evidence_spans"],
    "additionalProperties": False,
}


def _bedrock_config() -> Any:
    """Retry policy for both Bedrock clients.

    Adaptive rather than the default standard mode: it adds a client-side rate limiter that
    slows down when the service starts throttling, instead of firing the same burst again
    after a backoff. Labelling a corpus is exactly the shape that trips this -- a tight loop
    of one call per case against a per-account quota -- and the design note's reserved
    concurrency of 5 on the live Lambda is the same argument made in infrastructure.
    """
    from botocore.config import Config

    return Config(retries={"max_attempts": BEDROCK_MAX_ATTEMPTS, "mode": "adaptive"})


# STUB: one call per case. The 100k backfill uses CreateModelInvocationJob in batch.
class BedrockLabelExtractor:
    """Extraction against Claude on Amazon Bedrock, with the output shape enforced."""

    TOOL_NAME: Final[str] = "record_root_cause"

    def __init__(self, model_id: str = BEDROCK_MODEL_ID, region: str = BEDROCK_REGION) -> None:
        self._model_id = model_id
        self._region = region
        self._client: Any | None = None

    def _bedrock(self) -> Any:
        """One client per instance. boto3 resolves credentials itself; none are passed."""
        if self._client is None:
            import boto3

            self._client = boto3.client(
                "bedrock-runtime", region_name=self._region, config=_bedrock_config()
            )
        return self._client

    def extract(self, case: Case) -> ExtractedLabel:
        """One call per case, with the output shape held by a forced tool call."""
        response = self._bedrock().converse(
            modelId=self._model_id,
            messages=[{"role": "user", "content": [{"text": build_prompt(case)}]}],
            inferenceConfig={"maxTokens": 1024, "temperature": 0.0},
            toolConfig={
                "tools": [
                    {
                        "toolSpec": {
                            "name": self.TOOL_NAME,
                            "description": (
                                "Record the root cause the technician found in this closed "
                                "case, or record that they found none."
                            ),
                            "inputSchema": {"json": RESPONSE_SCHEMA},
                        }
                    }
                ],
                "toolChoice": {"tool": {"name": self.TOOL_NAME}},
            },
        )
        for block in response["output"]["message"]["content"]:
            if "toolUse" in block:
                return ExtractedLabel.model_validate(block["toolUse"]["input"])
        raise RuntimeError(
            f"Bedrock returned no tool call for {case.case_id}; "
            f"stop reason {response.get('stopReason')!r}"
        )


def default_extractor() -> LabelExtractor:
    """A real model, or an explicit refusal. There is no third option."""
    if aws_credentials_available():
        return BedrockLabelExtractor()
    raise RuntimeError(
        "No label extractor is available: no AWS credentials found. Configure them "
        "(`aws configure`, or AWS_PROFILE / AWS_ACCESS_KEY_ID in the environment), install "
        "the extra with `uv sync --extra bedrock`, and grant the account access to "
        f"{BEDROCK_MODEL_ID} in the Bedrock console. There is no offline fallback, because "
        "a label nobody inferred is worse than no label."
    )
