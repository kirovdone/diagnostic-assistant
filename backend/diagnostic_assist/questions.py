"""Choosing the one question worth asking next."""

from __future__ import annotations

import math
from collections import Counter
from collections.abc import Callable
from typing import Final, NamedTuple

from .config import EQUIPMENT_QUESTION_ID, MIN_INFORMATION_GAIN_BITS
from .equipment import Catalogue
from .models import AnswerOption, Question, Ranking, SymptomFeatures
from .retrieval import Neighbour


class Specialised(NamedTuple):
    """A question rewritten from the neighbours, and the feature values that go with it."""

    prompt: str
    options: tuple[AnswerOption, ...]
    values: tuple[str, ...]
    value_of: Callable[[SymptomFeatures], str | None]


class QuestionTemplate(NamedTuple):
    """One question, its options, and the feature an answer resolves to."""

    question_id: str
    feature: str
    prompt: str
    options: tuple[AnswerOption, ...]
    value_of: Callable[[SymptomFeatures], str | None]
    specialise: Callable[[tuple[Neighbour, ...]], Specialised | None] | None = None


def _error_code_value(features: SymptomFeatures) -> str | None:
    """The code a candidate's supporting cases actually print, if they agree."""
    if features.error_codes:
        return "present"
    if features.error_codes_absent:
        return "absent"
    return None


def _fluid_value(features: SymptomFeatures) -> str | None:
    """The fluid an answer claims, canonicalised."""
    return None if features.fluid_claimed == "unknown" else features.fluid_claimed


def _severity_value(features: SymptomFeatures) -> str | None:
    """Drip or continuous, read back out of the answer phrase."""
    return None if features.severity == "unknown" else features.severity


def _onset_value(features: SymptomFeatures) -> str | None:
    """The onset condition an answer names."""
    for condition in ("after_warmup", "cold", "under_load"):
        if condition in features.onset_conditions:
            return condition
    return None


def _recurrence_value(features: SymptomFeatures) -> str | None:
    """Whether the fault is said to have happened before."""
    return None if features.recurrence == "unknown" else features.recurrence


def _specialise_error_code(neighbours: tuple[Neighbour, ...]) -> Specialised | None:
    """Name the code the candidates actually print, or do not ask."""
    codes = Counter(code for n in neighbours for code in n.features.error_codes)
    if not codes:
        return None
    code, _ = codes.most_common(1)[0]

    def value_of(features: SymptomFeatures) -> str | None:
        """The feature value this answer resolves to, or None."""
        if code in features.error_codes:
            return code
        if features.error_codes or features.error_codes_absent:
            return "other"
        return None

    return Specialised(
        prompt=f"Does the panel show {code}?",
        options=(
            AnswerOption(value=f"{code} shown on the panel", label=f"Yes, {code}"),
            AnswerOption(value="no error codes displayed", label="No code shown"),
        ),
        values=(code, "other"),
        value_of=value_of,
    )


TEMPLATES: Final[tuple[QuestionTemplate, ...]] = (
    QuestionTemplate(
        question_id="error_code",
        feature="error_codes",
        prompt="Is the panel showing an error code?",
        options=(
            AnswerOption(value="error code shown on the panel", label="Yes, a code is shown"),
            AnswerOption(value="no error codes displayed", label="No code shown"),
        ),
        value_of=_error_code_value,
        specialise=_specialise_error_code,
    ),
    QuestionTemplate(
        question_id="fluid_type",
        feature="fluid_claimed",
        prompt="What is the fluid?",
        options=(
            AnswerOption(value="oil leak", label="Oil"),
            AnswerOption(value="water leak", label="Water"),
        ),
        value_of=_fluid_value,
    ),
    QuestionTemplate(
        question_id="severity",
        feature="severity",
        prompt="How fast is it coming out?",
        options=(
            AnswerOption(value="slow drip", label="A drip"),
            AnswerOption(value="continuous flow, puddle under the machine", label="A puddle"),
        ),
        value_of=_severity_value,
    ),
    QuestionTemplate(
        question_id="onset",
        feature="onset_conditions",
        prompt="When does it happen?",
        options=(
            AnswerOption(value="when the machine is cold", label="From cold"),
            AnswerOption(value="after 20 minutes of running", label="Once warmed up"),
            AnswerOption(value="under load", label="Under load"),
        ),
        value_of=_onset_value,
    ),
    QuestionTemplate(
        question_id="recurrence",
        feature="recurrence",
        prompt="Has this happened before on this machine?",
        options=(
            AnswerOption(value="happened again, third time", label="Yes, again"),
            AnswerOption(value="first occurrence, never happened before", label="First time"),
        ),
        value_of=_recurrence_value,
    ),
)

# STUB: five hand-written templates, each asking about a feature normalize.py can read back
# out of the answer. Production derives the question bank per equipment family from the
# features that actually separate that family's causes, and re-fits the gain floor on real
# sessions rather than on an estimate over 22 cases.


CANONICAL_VALUES: Final[dict[str, tuple[str, ...]]] = {
    "error_code": ("present", "absent"),
    "fluid_type": ("oil", "water"),
    "severity": ("drip", "continuous"),
    "onset": ("after_warmup", "cold", "under_load"),
    "recurrence": ("yes", "no"),
}


def equipment_question(catalogue: Catalogue, suggested: tuple[str, ...] = ()) -> Question:
    """Which machine is this, asked only when the description did not say."""
    families = [family for family in suggested if family in catalogue]
    families += [family for family in catalogue if family not in families]
    return Question(
        question_id=EQUIPMENT_QUESTION_ID,
        feature="equipment_family",
        prompt="Which machine is this?",
        options=tuple(AnswerOption(value=family, label=family) for family in families),
        expected_information_gain=0.0,
    )


def _entropy(probabilities: list[float]) -> float:
    """Shannon entropy of a probability vector, in bits."""
    return -sum(p * math.log2(p) for p in probabilities if p > 0)


def _conditional(
    value_of: Callable[[SymptomFeatures], str | None],
    supporters: list[Neighbour],
    values: tuple[str, ...],
) -> dict[str, float]:
    """P(answer | cause), estimated from the cases supporting that cause."""
    counts = {value: 1.0 for value in values}
    for neighbour in supporters:
        observed = value_of(neighbour.features)
        if observed in counts:
            counts[observed] += 1.0
    total = sum(counts.values())
    return {value: count / total for value, count in counts.items()}


def expected_information_gain(
    template: QuestionTemplate,
    ranking: Ranking,
    neighbours: tuple[Neighbour, ...],
    specialised: Specialised | None = None,
) -> float:
    """Bits of entropy the answer is expected to remove from the candidate distribution."""
    if not ranking.candidates:
        return 0.0

    canonical = specialised.values if specialised else CANONICAL_VALUES[template.question_id]
    value_of = specialised.value_of if specialised else template.value_of

    priors = [candidate.probability for candidate in ranking.candidates]
    priors.append(ranking.other_probability)
    total_prior = sum(priors)
    if total_prior <= 0:
        return 0.0
    priors = [p / total_prior for p in priors]

    conditionals: list[dict[str, float]] = []
    for candidate in ranking.candidates:
        supporters = [n for n in neighbours if n.cause_id == candidate.cause_id]
        conditionals.append(_conditional(value_of, supporters, canonical))
    conditionals.append(dict.fromkeys(canonical, 1.0 / len(canonical)))

    prior_entropy = _entropy(priors)
    posterior = 0.0
    for value in canonical:
        joint = [
            prior * conditional[value]
            for prior, conditional in zip(priors, conditionals, strict=True)
        ]
        marginal = sum(joint)
        if marginal <= 0:
            continue
        posterior += marginal * _entropy([j / marginal for j in joint])

    return max(prior_entropy - posterior, 0.0)


def next_question(
    ranking: Ranking,
    neighbours: tuple[Neighbour, ...],
    session_features: SymptomFeatures,
    already_asked: list[str],
) -> Question | None:
    """The highest-gain question still worth asking, or None to stop."""
    best: Question | None = None
    for template in TEMPLATES:
        if template.question_id in already_asked:
            continue
        if template.value_of(session_features) is not None:
            continue
        prompt, options = template.prompt, template.options
        specialised: Specialised | None = None
        if template.specialise is not None:
            specialised = template.specialise(neighbours)
            if specialised is None:
                continue
            prompt, options = specialised.prompt, specialised.options

        gain = expected_information_gain(template, ranking, neighbours, specialised)
        if gain < MIN_INFORMATION_GAIN_BITS:
            continue
        if best is None or gain > best.expected_information_gain:
            best = Question(
                question_id=template.question_id,
                feature=template.feature,
                prompt=prompt,
                options=options,
                expected_information_gain=gain,
            )
    return best
