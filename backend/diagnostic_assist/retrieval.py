"""Finding the closest closed cases to a live description."""

from __future__ import annotations

from typing import NamedTuple

from .config import (
    FEATURE_OVERLAP_WEIGHT,
    MIN_TYPE_NEIGHBOURS,
    TEXT_SIMILARITY_WEIGHT,
    TOP_K_NEIGHBOURS,
)
from .models import Case, CaseLabel, FallbackLevel, SymptomFeatures
from .normalize import extract_features, features_for_case
from .similarity import TextSimilarity, default_similarity


class LabelledCase(NamedTuple):
    """An indexed case: its text, its features, and the label that lets it vote."""

    case: Case
    label: CaseLabel
    features: SymptomFeatures


class Neighbour(NamedTuple):
    """One historical case that resembles the query, with how much it counts."""

    case_id: str
    cause_id: str
    similarity: float
    evidence_weight: float
    features: SymptomFeatures

    @property
    def vote(self) -> float:
        """Similarity weighted by how much this case's label is trusted."""
        return self.similarity * self.evidence_weight


class SearchResult(NamedTuple):
    """The neighbours found, and how wide the search had to go to find them."""

    neighbours: tuple[Neighbour, ...]
    fallback_level: FallbackLevel


# STUB: in-process scan. Production is one OpenSearch query, kNN + BM25 fused by RRF.
class CaseIndex:
    """Similarity search over labelled cases."""

    def __init__(
        self,
        cases: list[Case],
        labels: dict[str, CaseLabel],
        similarity: TextSimilarity | None = None,
    ) -> None:
        self._similarity: TextSimilarity = similarity or default_similarity()
        # Every equipment type code in the corpus has the shape of a lettered fault code, so
        # the extractor is told to ignore them: naming the machine is not reporting a fault.
        self.type_codes: frozenset[str] = frozenset(
            case.equipment_type.upper() for case in cases
        )
        self._known_families: frozenset[str] = frozenset(case.equipment_family for case in cases)
        self._entries: list[LabelledCase] = [
            LabelledCase(case=case, label=label, features=features_for_case(case, self.type_codes))
            for case in cases
            if (label := labels.get(case.case_id)) is not None
            and label.cause_id is not None
            and label.evidence_weight > 0.0
        ]
        self._similarity.fit([entry.case.customer_description for entry in self._entries])

    def __len__(self) -> int:
        return len(self._entries)

    @property
    def entries(self) -> tuple[LabelledCase, ...]:
        """Indexed cases in scope, narrowest first."""
        return tuple(self._entries)

    def _score_subset(
        self, query_text: str, query_features: SymptomFeatures, indices: list[int]
    ) -> list[Neighbour]:
        """Blend text similarity and feature overlap, and drop what falls under the floor."""
        if not indices:
            return []
        text_scores = self._similarity.scores(query_text, indices)

        neighbours: list[Neighbour] = []
        for position, index in enumerate(indices):
            entry = self._entries[index]
            overlap = query_features.feature_overlap(entry.features)
            similarity = (
                TEXT_SIMILARITY_WEIGHT * float(text_scores[position])
                + FEATURE_OVERLAP_WEIGHT * overlap
            )
            if similarity < self._similarity.min_similarity:
                continue
            assert entry.label.cause_id is not None
            neighbours.append(
                Neighbour(
                    case_id=entry.case.case_id,
                    cause_id=entry.label.cause_id,
                    similarity=similarity,
                    evidence_weight=entry.label.evidence_weight,
                    features=entry.features,
                )
            )
        neighbours.sort(key=lambda n: n.similarity, reverse=True)
        return neighbours[:TOP_K_NEIGHBOURS]

    def search(
        self,
        text: str,
        equipment_family: str | None,
        equipment_type: str | None,
    ) -> SearchResult:
        """Neighbours for a live description, and how hard we had to look."""
        if not self._entries:
            return SearchResult((), "global")

        query_features = extract_features(text, self.type_codes)

        type_indices = [
            i
            for i, e in enumerate(self._entries)
            if equipment_type is not None and e.case.equipment_type == equipment_type
        ]
        neighbours = self._score_subset(text, query_features, type_indices)
        if len(neighbours) >= MIN_TYPE_NEIGHBOURS:
            return SearchResult(tuple(neighbours), "type")

        family_indices = [
            i
            for i, e in enumerate(self._entries)
            if equipment_family is not None and e.case.equipment_family == equipment_family
        ]
        family_neighbours = self._score_subset(text, query_features, family_indices)
        if family_neighbours:
            return SearchResult(tuple(family_neighbours), "family")

        if equipment_family in self._known_families:
            # A family the corpus knows is as wide as the search goes, even when nothing in it
            # clears the floor: every cause outside it is one this machine cannot have, so
            # widening could only offer impossible causes. An empty family result is the
            # honest answer. A family the corpus has never seen is the one exception below --
            # there is no "outside" to rule out, and the ranker moves the mass to "other".
            return SearchResult((), "family")

        everything = list(range(len(self._entries)))
        return SearchResult(tuple(self._score_subset(text, query_features, everything)), "global")
