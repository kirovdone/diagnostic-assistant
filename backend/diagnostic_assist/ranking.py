"""Turning neighbours into probabilities that are allowed to be uncertain."""

from __future__ import annotations

from collections import defaultdict

from .config import (
    DEGRADED_EVIDENCE_MASS,
    MAX_CANDIDATES,
    MIN_CANDIDATE_PROBABILITY,
    OTHER_MASS_FAMILY_MULTIPLIER,
    OTHER_MASS_GLOBAL_MULTIPLIER,
    OTHER_PRIOR_MASS,
    RANKING_SMOOTHING_ALPHA,
)
from .models import Candidate, FallbackLevel, Ranking
from .retrieval import Neighbour
from .taxonomy import get_cause

_FALLBACK_MULTIPLIER: dict[FallbackLevel, float] = {
    "type": 1.0,
    "family": OTHER_MASS_FAMILY_MULTIPLIER,
    "global": OTHER_MASS_GLOBAL_MULTIPLIER,
}


def _applies_to(cause_id: str, equipment_family: str) -> bool:
    """Whether the taxonomy allows this cause on this equipment family."""
    cause = get_cause(cause_id)
    return cause is not None and equipment_family in cause.families


def other_mass(fallback_level: FallbackLevel) -> float:
    """Pseudo-count for "a cause we do not have"."""
    return OTHER_PRIOR_MASS * _FALLBACK_MULTIPLIER[fallback_level]


def rank(
    neighbours: tuple[Neighbour, ...],
    fallback_level: FallbackLevel,
    language: str = "en",
    equipment_family: str | None = None,
) -> Ranking:
    """Probabilities over root causes, plus the evidence to judge them by."""
    # A cause that has left the taxonomy cannot be a candidate, so counting its vote in the
    # denominator would quietly lose that mass instead of moving it to "something else".
    neighbours = tuple(n for n in neighbours if get_cause(n.cause_id) is not None)

    votes: dict[str, float] = defaultdict(float)
    supporters: dict[str, list[Neighbour]] = defaultdict(list)
    for neighbour in neighbours:
        votes[neighbour.cause_id] += neighbour.vote
        supporters[neighbour.cause_id].append(neighbour)

    evidence_mass = sum(votes.values())
    reserved = other_mass(fallback_level)
    denominator = evidence_mass + RANKING_SMOOTHING_ALPHA * len(votes) + reserved
    if denominator <= 0:
        return Ranking(
            candidates=(),
            other_probability=1.0,
            n_similar_cases=0,
            fallback_level=fallback_level,
            degraded=True,
        )

    scored: list[Candidate] = []
    for cause_id, vote in votes.items():
        cause = get_cause(cause_id)
        assert cause is not None  # filtered above
        ranked_supporters = sorted(supporters[cause_id], key=lambda n: n.similarity, reverse=True)
        scored.append(
            Candidate(
                cause_id=cause_id,
                label=cause.label(language),
                probability=(vote + RANKING_SMOOTHING_ALPHA) / denominator,
                n_supporting_cases=len(ranked_supporters),
                evidence_case_ids=tuple(n.case_id for n in ranked_supporters[:3]),
                typical_parts=cause.typical_parts,
            )
        )

    scored.sort(key=lambda candidate: candidate.probability, reverse=True)
    applicable = [
        candidate
        for candidate in scored
        if equipment_family is None or _applies_to(candidate.cause_id, equipment_family)
    ]
    kept = [c for c in applicable if c.probability >= MIN_CANDIDATE_PROBABILITY][:MAX_CANDIDATES]

    trimmed = sum(c.probability for c in scored) - sum(c.probability for c in kept)
    other_probability = reserved / denominator + trimmed

    return Ranking(
        candidates=tuple(kept),
        other_probability=min(other_probability, 1.0),
        n_similar_cases=len(neighbours),
        fallback_level=fallback_level,
        degraded=evidence_mass < DEGRADED_EVIDENCE_MASS or fallback_level == "global",
    )
