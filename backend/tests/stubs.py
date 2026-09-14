"""The extractor stub the tests inject, and the answer key they replay."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Final

from diagnostic_assist.models import Case, ExtractedLabel

# Hand-written answers for the 22 sample cases, standing in for the model. Evidence spans
# are copied out of the case text, so they exercise the span validation rather than
# bypassing it. Cases that the deterministic pre-checks resolve (C-49118 billing, C-49203
# warranty swap, C-49301 no fault found) are present and return null: the extractor never
# sees them in the normal flow, and if the pre-checks were ever removed the fixture must
# not quietly supply a cause they never had.
FIXTURES: Final[dict[str, ExtractedLabel]] = {
    "C-48211": ExtractedLabel(
        cause_id="CX.ELEC.CONTACTOR_FAILED",
        confidence=0.94,
        evidence_spans=("Main contactor coil open", "Swapped contactor, unit runs"),
    ),
    "C-48377": ExtractedLabel(
        cause_id="CX.ELEC.CONTACTOR_FAILED",
        confidence=0.92,
        evidence_spans=("Hauptschuetz defekt", "Hauptschuetz getauscht"),
    ),
    "C-48590": ExtractedLabel(
        cause_id="CX.ELEC.GROUND_STRAP_LOOSE",
        confidence=0.91,
        evidence_spans=(
            "Ground strap at frame was loose, heavy corrosion",
            "Loose ground strap, retorqued and treated corrosion",
        ),
    ),
    "C-48604": ExtractedLabel(
        cause_id="AP.HYD.BOOM_CYL_ROD_SEAL",
        confidence=0.93,
        evidence_spans=("Rod seal weeping", "Replaced cylinder seal kit"),
    ),
    "C-48712": ExtractedLabel(
        cause_id="CH.DRAIN.CONDENSATE_BLOCKED",
        confidence=0.9,
        evidence_spans=(
            "Fluid was condensate from the chiller drain pan, drain line was blocked",
            "Blocked condensate drain line, cleared",
        ),
    ),
    "C-48755": ExtractedLabel(
        cause_id="AP.HYD.BOOM_CYL_SCORED",
        confidence=0.89,
        evidence_spans=("Verin raye, fuite continue sous charge", "Verin remplace"),
    ),
    "C-48801": ExtractedLabel(
        cause_id="AP.HYD.BOOM_CYL_ROD_SEAL",
        confidence=0.62,
        evidence_spans=("ordered seal kit",),
    ),
    "C-48899": ExtractedLabel(
        cause_id="CX.MECH.VALVE_PLATE_WORN",
        confidence=0.94,
        evidence_spans=("Valve plate worn, reed cracked", "Worn valve plate replaced"),
    ),
    "C-48934": ExtractedLabel(
        cause_id="CX.COOL.INTAKE_BLOCKED",
        confidence=0.92,
        evidence_spans=(
            "intake screen packed with dust",
            "Blocked intake screen restricting airflow, cleaned",
        ),
    ),
    "C-49002": ExtractedLabel(
        cause_id="CX.ELEC.ALTERNATOR_NOT_CHARGING",
        confidence=0.95,
        evidence_spans=(
            "Alternator output 12.1V at 1500rpm, not charging",
            "Alternator not charging, replaced",
        ),
    ),
    "C-49040": ExtractedLabel(
        cause_id="CX.ELEC.BATTERY_FAILED",
        confidence=0.93,
        evidence_spans=("battery failed test", "Failed battery replaced"),
    ),
    "C-49118": ExtractedLabel(cause_id=None, confidence=0.0),
    "C-49203": ExtractedLabel(cause_id=None, confidence=0.0),
    "C-49266": ExtractedLabel(
        cause_id="CX.MECH.VALVE_PLATE_WORN",
        confidence=0.9,
        evidence_spans=("Piastra valvole usurata", "Piastra valvole sostituita"),
    ),
    "C-49301": ExtractedLabel(cause_id=None, confidence=0.0),
    "C-49355": ExtractedLabel(
        cause_id="CH.REFRIG.LEAK_SCHRADER",
        confidence=0.93,
        evidence_spans=(
            "Leak traced to schrader valve on suction line",
            "Low refrigerant charge, leak at schrader valve",
        ),
    ),
    "C-49402": ExtractedLabel(
        cause_id="CX.MECH.CONROD_BEARING_WORN",
        confidence=0.94,
        evidence_spans=(
            "cyl 1 conrod bearing worn",
            "Worn connecting rod bearing on cylinder 1 replaced",
        ),
    ),
    "C-49437": ExtractedLabel(
        cause_id="CX.MECH.REED_VALVE_BROKEN",
        confidence=0.91,
        evidence_spans=(
            "Broken reed valve fragment sitting in cyl 2",
            "Broken valve fragment in cylinder 2 removed, valve replaced",
        ),
    ),
    "C-49480": ExtractedLabel(
        cause_id="CX.MECH.CONROD_BEARING_WORN",
        confidence=0.92,
        evidence_spans=("Pleuellager Zylinder 1 verschlissen", "Pleuellager Zylinder 1 ersetzt"),
    ),
    "C-49511": ExtractedLabel(
        cause_id="CH.WATER.PUMP_SEAL_FAILED",
        confidence=0.94,
        evidence_spans=(
            "Condenser pump mechanical seal failed",
            "Condenser water pump seal replaced",
        ),
    ),
    "C-49544": ExtractedLabel(
        cause_id="CH.WATER.FITTING_CORRODED",
        confidence=0.93,
        evidence_spans=(
            "Corroded compression fitting on chilled water return line",
            "Corroded fitting on chilled water return replaced",
        ),
    ),
    "C-49590": ExtractedLabel(
        cause_id="CH.WATER.PUMP_SEAL_FAILED",
        confidence=0.9,
        evidence_spans=("Traced to condenser pump seal, weeping under pressure",),
    ),
}


class StubExtractor:
    """A test double, constructed explicitly. It infers nothing."""

    def __init__(self, fixtures: dict[str, ExtractedLabel] | None = None) -> None:
        self._fixtures = fixtures if fixtures is not None else FIXTURES

    def extract(self, case: Case) -> ExtractedLabel:
        return self._fixtures.get(case.case_id, ExtractedLabel(cause_id=None, confidence=0.0))


class StubSimilarity:
    """Deterministic lexical similarity, for tests only."""

    # Lexical cosines live on a different scale from embedding ones; this is the value the
    # floor had when the package scored text this way.
    min_similarity: float = 0.08

    def __init__(self) -> None:
        from sklearn.feature_extraction.text import TfidfVectorizer

        self._vectorizer = TfidfVectorizer(
            analyzer="char_wb", ngram_range=(3, 5), min_df=1, sublinear_tf=True
        )
        self._matrix: object | None = None

    def fit(self, texts: Sequence[str]) -> None:
        if texts:
            self._matrix = self._vectorizer.fit_transform(list(texts))

    def scores(self, query: str, indices: Sequence[int]) -> list[float]:
        from sklearn.metrics.pairwise import cosine_similarity

        if self._matrix is None or not indices:
            return []
        vector = self._vectorizer.transform([query])
        return [float(x) for x in cosine_similarity(vector, self._matrix[list(indices)])[0]]
