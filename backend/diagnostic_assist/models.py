"""The vocabulary of the system. Every module below speaks in these types."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field

from .config import EQUIPMENT_QUESTION_ID, REVIEW_CONFIDENCE_THRESHOLD

Language = Literal["de", "en", "fr", "it"]
FluidClaim = Literal["oil", "water", "unknown"]
SeverityHint = Literal["drip", "continuous", "unknown"]
TriState = Literal["yes", "no", "unknown"]


class Case(BaseModel):
    """One closed historical case, exactly as it arrives from the corpus."""

    model_config = ConfigDict(frozen=True)

    case_id: str
    equipment_family: str
    equipment_type: str
    created_at: datetime
    language: Language
    customer_description: str
    technician_notes: str
    parts_replaced: tuple[str, ...] = ()
    resolution_text: str | None = None

    @property
    def technician_text(self) -> str:
        """What the technician wrote. This is where the truth lives."""
        return " ".join(part for part in (self.technician_notes, self.resolution_text) if part)

    @property
    def full_text(self) -> str:
        """Everything written about the case, for span validation.

        Not what is embedded: the index compares customer text with customer text, because a
        live session has only the customer's half.
        """
        return " ".join(
            part
            for part in (self.customer_description, self.technician_notes, self.resolution_text)
            if part
        )


class OutcomeStatus(StrEnum):
    """What kind of thing this closed case turned out to be."""

    CONFIRMED = "CONFIRMED"
    PROVISIONAL = "PROVISIONAL"
    NO_FAULT_FOUND = "NO_FAULT_FOUND"
    NON_DIAGNOSTIC = "NON_DIAGNOSTIC"
    NON_TECHNICAL = "NON_TECHNICAL"


class LabelFlag(StrEnum):
    """Why a human might want to look at this label."""

    UNMAPPED = "UNMAPPED"

    # An abstention and a failed call are not rejections. Keeping all three under UNMAPPED
    # would make the UNMAPPED rate -- the alarm for a model inventing causes -- unreadable.
    NO_CAUSE_EXTRACTED = "NO_CAUSE_EXTRACTED"
    EXTRACTION_FAILED = "EXTRACTION_FAILED"

    NO_PART_FIX = "NO_PART_FIX"

    CUSTOMER_SYMPTOM_MISMATCH = "CUSTOMER_SYMPTOM_MISMATCH"

    PART_CAUSE_CONTRADICTION = "PART_CAUSE_CONTRADICTION"

    EVIDENCE_NOT_IN_TEXT = "EVIDENCE_NOT_IN_TEXT"

    TEMPORARY_FIX = "TEMPORARY_FIX"
    NULL_RESOLUTION = "NULL_RESOLUTION"

    WHOLE_UNIT_SWAP = "WHOLE_UNIT_SWAP"


class EquipmentBasis(StrEnum):
    """How the machine in front of the user was established. See equipment.py."""

    TYPE_CODE = "TYPE_CODE"
    FAMILY_NAME = "FAMILY_NAME"
    COMPONENT = "COMPONENT"
    STATED = "STATED"


class EquipmentGuess(BaseModel):
    """What a description says about the machine, and on what grounds."""

    model_config = ConfigDict(frozen=True)

    family: str | None = None
    equipment_type: str | None = None
    basis: EquipmentBasis | None = None
    matched_families: tuple[str, ...] = ()

    @property
    def resolved(self) -> bool:
        """True when a family could be read out of the text."""
        return self.family is not None


class SymptomFeatures(BaseModel):
    """Structured facts pulled out of free text by normalize.py."""

    model_config = ConfigDict(frozen=True)

    error_codes: tuple[str, ...] = ()
    error_codes_absent: bool = False
    fluid_claimed: FluidClaim = "unknown"
    severity: SeverityHint = "unknown"
    recurrence: TriState = "unknown"
    onset_conditions: tuple[str, ...] = ()
    normalized_text: str = ""

    def feature_overlap(self, other: SymptomFeatures) -> float:
        """Agreement between two cases on the structured facts, in [0, 1]."""
        scores: list[float] = []

        if self.error_codes or other.error_codes:
            shared = set(self.error_codes) & set(other.error_codes)
            union = set(self.error_codes) | set(other.error_codes)
            scores.append(len(shared) / len(union) if union else 0.0)

        if self.error_codes_absent or other.error_codes_absent:
            scores.append(1.0 if self.error_codes_absent == other.error_codes_absent else 0.0)

        for mine, theirs in (
            (self.fluid_claimed, other.fluid_claimed),
            (self.severity, other.severity),
        ):
            if mine != "unknown" or theirs != "unknown":
                scores.append(1.0 if mine == theirs else 0.0)

        if self.recurrence != "unknown" or other.recurrence != "unknown":
            scores.append(1.0 if self.recurrence == other.recurrence else 0.0)

        if self.onset_conditions or other.onset_conditions:
            shared_onset = set(self.onset_conditions) & set(other.onset_conditions)
            union_onset = set(self.onset_conditions) | set(other.onset_conditions)
            scores.append(len(shared_onset) / len(union_onset) if union_onset else 0.0)

        return sum(scores) / len(scores) if scores else 0.0


class CaseLabel(BaseModel):
    """The output of labeling.py: what this closed case says about root causes."""

    model_config = ConfigDict(frozen=True)

    case_id: str
    taxonomy_version: str
    outcome_status: OutcomeStatus
    cause_id: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_weight: float = Field(ge=0.0, le=1.0)
    flags: tuple[LabelFlag, ...] = ()
    evidence_spans: tuple[str, ...] = ()

    @computed_field  # type: ignore[prop-decorator]
    @property
    def needs_review(self) -> bool:
        """Whether a human should look at this row before it is trusted."""
        return LabelFlag.UNMAPPED in self.flags or self.confidence <= REVIEW_CONFIDENCE_THRESHOLD


class ExtractedLabel(BaseModel):
    """The raw claim a LabelExtractor makes, before any of it is believed."""

    cause_id: str | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    evidence_spans: tuple[str, ...] = ()


class Candidate(BaseModel):
    """One possible root cause, with the probability the ranker assigns it."""

    model_config = ConfigDict(frozen=True)

    cause_id: str
    label: str
    probability: float = Field(ge=0.0, le=1.0)
    n_supporting_cases: int
    evidence_case_ids: tuple[str, ...] = ()
    typical_parts: tuple[str, ...] = ()


FallbackLevel = Literal["type", "family", "global"]


class Ranking(BaseModel):
    """A full answer: the candidates plus everything needed to judge whether to trust it."""

    model_config = ConfigDict(frozen=True)

    candidates: tuple[Candidate, ...] = ()
    other_probability: float = Field(ge=0.0, le=1.0)
    n_similar_cases: int
    fallback_level: FallbackLevel
    degraded: bool = False


class AnswerOption(BaseModel):
    """One tappable answer, and the phrase it feeds back into retrieval."""

    model_config = ConfigDict(frozen=True)

    value: str
    label: str


class Question(BaseModel):
    """A follow-up question, chosen because the answer would change the ranking."""

    model_config = ConfigDict(frozen=True)

    question_id: str
    feature: str
    prompt: str
    options: tuple[AnswerOption, ...]
    expected_information_gain: float


class Answer(BaseModel):
    """An answer as given, kept so the session can re-rank from scratch."""

    question_id: str
    value: str


class SessionStatus(StrEnum):
    """Open until someone confirms a cause or declines to."""

    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"


class Session(BaseModel):
    """One diagnosis in progress. Lives in memory here; see the STUB in api.py."""

    session_id: str
    equipment_family: str | None = None
    equipment_type: str | None = None
    equipment_basis: EquipmentBasis | None = None
    language: str = "en"
    description: str
    created_at: datetime
    status: SessionStatus = SessionStatus.ACTIVE
    answers: dict[str, str] = Field(default_factory=dict)
    asked_question_ids: list[str] = Field(default_factory=list)
    pending_question: Question | None = None
    seq: int = 0
    confirmed_cause_id: str | None = None

    def effective_text(self) -> str:
        """The description plus every answer given, as one blob for retrieval."""
        symptoms = [
            value
            for question_id, value in self.answers.items()
            if question_id != EQUIPMENT_QUESTION_ID
        ]
        # Separated, not spaced: a description ending in a negated clause ("no alarm") would
        # otherwise swallow the answer phrase into the negation and lose the feature the
        # question was asked to set.
        return "; ".join([self.description, *symptoms])
