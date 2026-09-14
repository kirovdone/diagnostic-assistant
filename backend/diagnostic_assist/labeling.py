"""Turning a closed case into a root-cause label. This is the riskiest component."""

from __future__ import annotations

import logging
import re
from typing import Final, NamedTuple

from pydantic import ValidationError

from .config import (
    CONFIDENCE_CEILING_UNMAPPED,
    CONFIDENCE_DETERMINISTIC,
    EVIDENCE_WEIGHT_CONFIRMED,
    EVIDENCE_WEIGHT_EXCLUDED,
    EVIDENCE_WEIGHT_PROVISIONAL,
    MIN_CONFIDENCE_FOR_CONFIRMED,
)
from .extractor import LabelExtractor
from .models import Case, CaseLabel, ExtractedLabel, LabelFlag, OutcomeStatus
from .normalize import features_for_case, normalize_text
from .taxonomy import PART_TO_CAUSE, TAXONOMY_VERSION, get_cause

log = logging.getLogger(__name__)


class PreCheck(NamedTuple):
    """A phrase-level rule over what the technician wrote."""

    status: OutcomeStatus
    patterns: tuple[str, ...]
    flags: tuple[LabelFlag, ...] = ()
    terminal: bool = True


PRE_CHECKS: Final[tuple[PreCheck, ...]] = (
    PreCheck(
        status=OutcomeStatus.NON_TECHNICAL,
        patterns=(
            r"\bnot a technical issue\b",
            r"\bkein technisches problem\b",
            r"\bdisputes? the invoice\b",
            r"\bforwarded to billing\b",
            r"\bbilling (?:dispute|query|enquiry)\b",
            r"\brechnungsstreit\b",
            r"\blitige de facturation\b",
            r"\bcontestazione della fattura\b",
        ),
    ),
    PreCheck(
        status=OutcomeStatus.NON_DIAGNOSTIC,
        patterns=(
            r"\bswapped out complete unit\b",
            r"\bswapped (?:the )?(?:complete|whole|entire) unit\b",
            r"\breplaced (?:the )?(?:complete|whole|entire) unit\b",
            r"\breplaced unit under warranty\b",
            r"\bkomplettger(?:ae|a)te?\b.{0,20}\b(?:getauscht|ersetzt)\b",
            r"\baustauschger(?:ae|a)te?\b",
        ),
        flags=(LabelFlag.WHOLE_UNIT_SWAP,),
    ),
    PreCheck(
        status=OutcomeStatus.NO_FAULT_FOUND,
        patterns=(
            r"\bno faults? found\b(?!\s+(?:in|on|at|with)\b)",
            r"\bkeine? fehler (?:gefunden|festgestellt)\b",
            r"\bkein fehler (?:feststellbar|erkennbar)\b",
            r"\baucun defaut (?:trouve|constate)\b",
            r"\bnessun guasto (?:riscontrato|trovato)\b",
        ),
    ),
    PreCheck(
        status=OutcomeStatus.NO_FAULT_FOUND,
        patterns=(
            r"\bcould not reproduce\b",
            r"\bunable to reproduce\b",
            r"\bnicht reproduzierbar\b",
        ),
        # Not terminal: "could not reproduce at first" is how half of real diagnoses open.
        # The status only stands if the model then finds nothing either.
        terminal=False,
    ),
    PreCheck(
        status=OutcomeStatus.PROVISIONAL,
        patterns=(
            r"\btemporary (?:fix|repair|measure)\b",
            r"\bprovisorisch",
            r"\bnotreparatur\b",
            r"\breparation temporaire\b",
            r"\briparazione temporanea\b",
            r"\bto rebook\b",
            r"\bawaiting (?:part|parts|delivery)\b",
            r"\bpart(?:s)? on order\b",
        ),
        flags=(LabelFlag.TEMPORARY_FIX,),
        terminal=False,
    ),
)

_WHOLE_UNIT_PART = re.compile(r"^UNIT[-_]", re.IGNORECASE)

_SWAP_CORROBORATION = re.compile(
    r"\b(?:warrant\w*|garantie|garanzia|garantia|per policy|did not strip\w*|"
    r"nicht zerlegt|komplettger\w*|austauschger\w*|"
    r"(?:whole|complete|entire) unit)\b",
    re.IGNORECASE,
)


class _PreCheckHit(NamedTuple):
    """A deterministic pre-check that matched, and the phrase that triggered it."""

    check: PreCheck
    span: str


def _find_span(patterns: tuple[str, ...], raw: str, normalized: str) -> str | None:
    """The first pattern hit, quoted from the original text where possible."""
    for pattern in patterns:
        raw_match = re.search(pattern, raw, re.IGNORECASE)
        if raw_match:
            return raw_match.group(0)
    for pattern in patterns:
        norm_match = re.search(pattern, normalized)
        if norm_match:
            return norm_match.group(0)
    return None


def run_pre_checks(case: Case) -> _PreCheckHit | None:
    """First matching pre-check over the technician's text, or None."""
    raw = case.technician_text
    normalized = normalize_text(raw)

    whole_unit = next((part for part in case.parts_replaced if _WHOLE_UNIT_PART.match(part)), None)
    if whole_unit and _SWAP_CORROBORATION.search(raw):
        swap = next(check for check in PRE_CHECKS if check.status is OutcomeStatus.NON_DIAGNOSTIC)
        return _PreCheckHit(swap, _find_span(swap.patterns, raw, normalized) or whole_unit)

    for check in PRE_CHECKS:
        found = _find_span(check.patterns, raw, normalized)
        if found:
            return _PreCheckHit(check, found)
    return None


def _span_occurs_in(span: str, case: Case) -> bool:
    """Whether an evidence span is really in the case text."""
    needle = normalize_text(span)
    return bool(needle) and needle in normalize_text(case.full_text)


def _span_is_the_technician(span: str, case: Case) -> bool:
    """Whether this quotation comes from the half of the case that found the fault."""
    needle = normalize_text(span)
    return bool(needle) and needle in normalize_text(case.technician_text)


def validate(case: Case, extracted: ExtractedLabel) -> tuple[str | None, list[LabelFlag]]:
    """Check an extracted label against the taxonomy, the text and the parts list.

    Validation never repairs a label. A label that needs repair is a label a
    human should look at.
    """
    flags: list[LabelFlag] = []
    cause_id = extracted.cause_id

    # 1. The cause must exist in the frozen taxonomy...
    if cause_id is None:
        return None, [LabelFlag.NO_CAUSE_EXTRACTED]
    cause = get_cause(cause_id)
    if cause is None:
        return None, [LabelFlag.UNMAPPED]

    # 2. ...and be possible on this family.
    if case.equipment_family not in cause.families:
        return None, [LabelFlag.UNMAPPED]

    # 3. Every quoted span must occur in the case text, and a claim with no quotation
    # at all fails rather than passes -- quoting nothing must not be the cheapest way
    # past the check.
    if not extracted.evidence_spans:
        return None, [LabelFlag.UNMAPPED, LabelFlag.EVIDENCE_NOT_IN_TEXT]
    unsupported = [span for span in extracted.evidence_spans if not _span_occurs_in(span, case)]
    if unsupported:
        return None, [LabelFlag.UNMAPPED, LabelFlag.EVIDENCE_NOT_IN_TEXT]

    # 4. At least one quotation must be the technician's. The customer's line is a symptom
    # reported second-hand, so a cause justified only from it is the model agreeing with the
    # caller -- which is the failure this whole system exists to catch. One span is enough:
    # the model legitimately quotes the customer alongside the technician.
    if not any(_span_is_the_technician(span, case) for span in extracted.evidence_spans):
        return None, [LabelFlag.UNMAPPED, LabelFlag.EVIDENCE_NOT_IN_TEXT]

    # 5. Parts are a consistency check, never a source. One supporting part settles it:
    # technicians fix more than one thing per visit, and a stricter rule sent real
    # diagnoses to review because the van also carried a filter.
    catalogued = [part for part in case.parts_replaced if part in PART_TO_CAUSE]
    if catalogued and all(PART_TO_CAUSE[part] != cause_id for part in catalogued):
        return None, [LabelFlag.UNMAPPED, LabelFlag.PART_CAUSE_CONTRADICTION]

    if not case.parts_replaced:
        flags.append(LabelFlag.NO_PART_FIX)

    customer = features_for_case(case)
    if (
        cause.fluid is not None
        and customer.fluid_claimed != "unknown"
        and customer.fluid_claimed != cause.fluid
    ):
        flags.append(LabelFlag.CUSTOMER_SYMPTOM_MISMATCH)

    return cause_id, flags


def _evidence_weight(status: OutcomeStatus, flags: tuple[LabelFlag, ...]) -> float:
    """How much this case is allowed to influence a future diagnosis."""
    if LabelFlag.UNMAPPED in flags or LabelFlag.NO_CAUSE_EXTRACTED in flags:
        return EVIDENCE_WEIGHT_EXCLUDED
    if status is OutcomeStatus.CONFIRMED:
        return EVIDENCE_WEIGHT_CONFIRMED
    if status is OutcomeStatus.PROVISIONAL:
        return EVIDENCE_WEIGHT_PROVISIONAL
    return EVIDENCE_WEIGHT_EXCLUDED


def label_case(case: Case, extractor: LabelExtractor) -> CaseLabel:
    """The label for one closed case."""
    hit = run_pre_checks(case)
    pre_flags: list[LabelFlag] = list(hit.check.flags) if hit else []
    pre_spans: tuple[str, ...] = (hit.span,) if hit else ()

    if case.resolution_text is None:
        pre_flags.append(LabelFlag.NULL_RESOLUTION)

    if hit and hit.check.terminal:
        flags = tuple(dict.fromkeys(pre_flags))
        return CaseLabel(
            case_id=case.case_id,
            taxonomy_version=TAXONOMY_VERSION,
            outcome_status=hit.check.status,
            cause_id=None,
            confidence=CONFIDENCE_DETERMINISTIC,
            evidence_weight=_evidence_weight(hit.check.status, flags),
            flags=flags,
            evidence_spans=pre_spans,
        )

    try:
        extracted = extractor.extract(case)
    except (ValidationError, RuntimeError):
        # One unusable answer is one row for review, not a failed corpus. Upstream failures
        # (UpstreamUnavailable) are not caught here: those are a 503, not a bad label.
        log.exception("extraction failed for %s; the row goes to review unlabelled", case.case_id)
        extracted = ExtractedLabel()
        pre_flags.append(LabelFlag.EXTRACTION_FAILED)

    if hit and extracted.cause_id is None and hit.check.status is OutcomeStatus.NO_FAULT_FOUND:
        # The note said it could not be reproduced and the model found nothing either.
        flags = tuple(dict.fromkeys(pre_flags))
        return CaseLabel(
            case_id=case.case_id,
            taxonomy_version=TAXONOMY_VERSION,
            outcome_status=hit.check.status,
            cause_id=None,
            confidence=CONFIDENCE_DETERMINISTIC,
            evidence_weight=_evidence_weight(hit.check.status, flags),
            flags=flags,
            evidence_spans=pre_spans,
        )

    cause_id, validation_flags = validate(case, extracted)
    flags = tuple(dict.fromkeys([*pre_flags, *validation_flags]))

    if LabelFlag.UNMAPPED in flags or LabelFlag.NO_CAUSE_EXTRACTED in flags:
        status = OutcomeStatus.PROVISIONAL
        confidence = min(extracted.confidence, CONFIDENCE_CEILING_UNMAPPED)
    elif (
        LabelFlag.TEMPORARY_FIX in flags
        or LabelFlag.NULL_RESOLUTION in flags
        or extracted.confidence < MIN_CONFIDENCE_FOR_CONFIRMED
    ):
        status = OutcomeStatus.PROVISIONAL
        confidence = extracted.confidence
    else:
        status = OutcomeStatus.CONFIRMED
        confidence = extracted.confidence

    spans = tuple(dict.fromkeys([*pre_spans, *extracted.evidence_spans]))
    return CaseLabel(
        case_id=case.case_id,
        taxonomy_version=TAXONOMY_VERSION,
        outcome_status=status,
        cause_id=cause_id,
        confidence=confidence,
        evidence_weight=_evidence_weight(status, flags),
        flags=flags,
        evidence_spans=spans,
    )


def label_corpus(cases: list[Case], extractor: LabelExtractor) -> list[CaseLabel]:
    """Label every case. Sequential here; see the STUB in extractor.py for the backfill."""
    return [label_case(case, extractor) for case in cases]
