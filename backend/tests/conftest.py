from __future__ import annotations

import pytest

from diagnostic_assist.api import _Corpus, set_corpus
from diagnostic_assist.corpus import load_cases
from diagnostic_assist.labeling import label_case
from diagnostic_assist.models import Case, CaseLabel

from .stubs import StubExtractor, StubSimilarity

# Install a corpus the stub labelled, before any test reaches a route.
#
# `diagnostic_assist` ships no offline extractor: `default_extractor` returns a real model
# or raises, so nothing in the product can serve a label nobody inferred. That leaves the
# suite needing an extractor of its own, and this is where it says so — once, visibly, in
# the test package, rather than as a fallback hidden inside the thing being tested.
#
# Both halves are injected, and the similarity matters as much as the extractor: with AWS
# credentials on the machine, `default_similarity()` would embed all 22 cases through Bedrock
# during collection. A suite whose speed and cost depend on whether the developer happens to be
# logged in is not a suite.
#
# The API builds its corpus on first use rather than at import, which is what makes this
# possible: importing the app costs nothing, and whoever gets there first decides what
# labelled and indexed it.
set_corpus(_Corpus(extractor=StubExtractor(), similarity=StubSimilarity()))


@pytest.fixture(scope="session")
def cases() -> dict[str, Case]:
    return {case.case_id: case for case in load_cases()}


@pytest.fixture(scope="session")
def extractor() -> StubExtractor:
    return StubExtractor()


@pytest.fixture(scope="session")
def labels(cases: dict[str, Case], extractor: StubExtractor) -> dict[str, CaseLabel]:
    return {case_id: label_case(case, extractor) for case_id, case in cases.items()}
