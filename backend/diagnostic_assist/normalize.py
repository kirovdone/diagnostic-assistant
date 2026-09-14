"""Turning field-written free text into something two cases can be compared on."""

from __future__ import annotations

import re
import unicodedata
from typing import Final, NamedTuple

from .config import NEGATION_SCOPE_TOKENS
from .models import Case, FluidClaim, SeverityHint, SymptomFeatures, TriState


class Abbreviation(NamedTuple):
    """One shorthand expansion."""

    pattern: str
    expansion: str
    right_context: str | None = None


ABBREVIATIONS: Final[tuple[Abbreviation, ...]] = (
    Abbreviation(r"hyd\.?", "hydraulic"),
    Abbreviation(r"lk", "leak"),
    Abbreviation(r"cyl", "cylinder"),
    Abbreviation(r"drp", "drop"),
    Abbreviation(r"cust", "customer"),
    Abbreviation(r"w/", "with"),
    Abbreviation(r"@", "at"),
    Abbreviation(r"approx\.?", "approximately"),
    Abbreviation(r"repl\.?", "replaced"),
    Abbreviation(r"temp", "temporary", right_context=r"fix|repair|solution|patch"),
)

_PREFIXED_CODE = re.compile(
    r"\b(?:(?:err|error|errors|fehler|erreur|errore)\s?-?\s?|e-?)(\d{2,4})\b",
    re.IGNORECASE,
)

_LETTERED_CODE = re.compile(r"\b([A-Z]{2,4})-(\d{1,3})\b")

_CODE_TOPIC = re.compile(
    r"\b(code|codes|fault code|error|errors|fehler|fehlercode|erreur|errore|codice|codici)\b",
    re.IGNORECASE,
)

_NEGATION_CUE = re.compile(
    r"\b(no|not|none|never|without|kein|keine|keinen|nicht|ohne|"
    r"aucun|aucune|pas|sans|nessun|nessuna|non|senza)\b",
    re.IGNORECASE,
)

_SENTENCE_END = re.compile(r"[.;!?,]")

FLUID_CUES: Final[dict[FluidClaim, tuple[str, ...]]] = {
    "oil": ("oil*", "oel", "ol", "huile*", "olio", "hydraulic*", "hydraulique*", "idraulic*"),
    "water": (
        "water*",
        "wasser",
        "eau",
        "acqua",
        "condensate",
        "condensats",
        "kondensat",
        "condensa",
    ),
}

SEVERITY_CUES: Final[dict[SeverityHint, tuple[str, ...]]] = {
    "continuous": (
        "puddle*",
        "pool",
        "pools",
        "flaque*",
        "pozza",
        "pfutze",
        "spraying",
        "continuous",
        "continua",
        "importante",
        "steady",
        "pouring",
        "under pressure",
    ),
    "drip": (
        "drip*",
        "drop",
        "drops",
        "weep*",
        "seep*",
        "tropf*",
        "goutte*",
        "gocce",
        "gocciol*",
        "slow leak",
    ),
}

RECURRENCE_DENIAL_CUES: Final[tuple[str, ...]] = (
    "first occurrence",
    "first time",
    "never happened before",
    "not happened before",
    "erstes mal",
    "premiere fois",
    "prima volta",
)

RECURRENCE_CUES: Final[tuple[str, ...]] = (
    "again",
    "wieder",
    "erneut",
    "nochmal",
    "encore",
    "de nouveau",
    "di nuovo",
    "ancora",
    "recurring",
    "recurs",
    "keeps",
    "every time",
    "most mornings",
    "second time",
    "third time",
    "fourth time",
    "2nd time",
    "3rd time",
    "zweites mal",
    "drittes mal",
)

ONSET_EXCLUSIONS: Final[dict[str, tuple[str, ...]]] = {
    "cold": ("cold water", "cold side", "cold circuit", "kaltwasser", "eau froide"),
}

ONSET_CUES: Final[dict[str, tuple[str, ...]]] = {
    "cold": ("cold", "kalt", "froid", "freddo", "morning*", "morgens", "a freddo"),
    "under_load": (
        "under load",
        "unter last",
        "sous charge",
        "sotto carico",
        "high load",
        "full load",
    ),
    "at_start": (
        "won't start",
        "wont start",
        "will not start",
        "does not start",
        "no crank",
        "startet nicht",
        "ne demarre pas",
        "non parte",
        "power up",
        "dead on arrival",
    ),
}

_AFTER_MINUTES = re.compile(
    r"\b(?:after|nach|apres|dopo)\b[^;!?]{0,15}?\b(\d{1,3})\s*(?:min|minutes?|minuten|minuti)\b",
    re.IGNORECASE,
)


def fold_accents(text: str) -> str:
    """Strip diacritics so `verin`, `vérin` and `Vérin` are one token."""
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def canonical_error_code(raw: str) -> str:
    """Canonicalise a single code token. `E-207`, `e207`, `err 207` -> `E207`."""
    token = raw.strip()
    match = _PREFIXED_CODE.fullmatch(token)
    if match:
        return f"E{match.group(1)}"
    lettered = _LETTERED_CODE.fullmatch(token.upper())
    if lettered:
        return f"{lettered.group(1)}-{lettered.group(2)}"
    return token.upper()


def expand_abbreviations(text: str) -> str:
    """Apply the shorthand table to already-lowercased text."""
    result = text
    for abbrev in ABBREVIATIONS:
        if abbrev.right_context is None:
            pattern = rf"(?<!\w){abbrev.pattern}(?!\w)"
            replacement = abbrev.expansion
        else:
            pattern = rf"(?<!\w){abbrev.pattern}(?!\w)(\s+(?:{abbrev.right_context})\b)"
            replacement = abbrev.expansion + r"\1"
        result = re.sub(pattern, replacement, result)
    return result


def normalize_text(text: str) -> str:
    """Lowercase, fold accents, expand shorthand, canonicalise codes, collapse space."""
    folded = fold_accents(text).lower()
    expanded = expand_abbreviations(folded)
    coded = _PREFIXED_CODE.sub(lambda m: f"e{m.group(1)}", expanded)
    return re.sub(r"\s+", " ", coded).strip()


def negated_ranges(text: str) -> tuple[tuple[int, int], ...]:
    """Character ranges of the original text that sit inside a negation."""
    lowered = text.lower()
    ranges: list[tuple[int, int]] = []
    for cue in _NEGATION_CUE.finditer(lowered):
        start = cue.end()
        rest = lowered[start:]
        sentence_end = _SENTENCE_END.search(rest)
        limit = start + (sentence_end.start() if sentence_end else len(rest))
        tokens = list(re.finditer(r"\S+", lowered[start:limit]))[:NEGATION_SCOPE_TOKENS]
        if tokens:
            ranges.append((start, start + tokens[-1].end()))
    return tuple(ranges)


def negated_clauses(text: str) -> tuple[str, ...]:
    """The text of every negated clause, lowercased."""
    lowered = text.lower()
    return tuple(lowered[start:end] for start, end in negated_ranges(text))


def _is_negated(position: int, ranges: tuple[tuple[int, int], ...]) -> bool:
    """Whether a match falls inside a negation's scope."""
    return any(start <= position < end for start, end in ranges)


def extract_error_codes(text: str) -> tuple[tuple[str, ...], bool]:
    """Return (codes present, codes explicitly absent)."""
    ranges = negated_ranges(text)
    absent = any(_CODE_TOPIC.search(clause) for clause in negated_clauses(text))

    codes: list[str] = []
    claimed: list[tuple[int, int]] = []
    for match in _PREFIXED_CODE.finditer(text):
        claimed.append((match.start(), match.end()))
        if _is_negated(match.start(), ranges):
            absent = True
            continue
        code = f"E{match.group(1)}"
        if code not in codes:
            codes.append(code)
    for match in _LETTERED_CODE.finditer(text):
        if any(start <= match.start() < end for start, end in claimed):
            continue
        if _is_negated(match.start(), ranges):
            absent = True
            continue
        code = f"{match.group(1)}-{match.group(2)}"
        if code not in codes:
            codes.append(code)
    return tuple(codes), absent


def _has_cue(normalized: str, cue: str, negated: tuple[tuple[int, int], ...] = ()) -> bool:
    """Whether a cue occurs as a word, outside any negation."""
    pattern = rf"\b{re.escape(cue[:-1])}\w*" if cue.endswith("*") else rf"\b{re.escape(cue)}\b"
    for match in re.finditer(pattern, normalized):
        if not any(start <= match.start() < end for start, end in negated):
            return True
    return False


def match_cue_table(
    normalized: str,
    table: dict[str, tuple[str, ...]],
    negated: tuple[tuple[int, int], ...] = (),
    exclusions: dict[str, tuple[str, ...]] | None = None,
) -> tuple[str, ...]:
    """Every key whose cues appear in the text, anchored on both edges."""
    matched: list[str] = []
    for key, cues in table.items():
        blocked = (exclusions or {}).get(key, ())
        if any(_has_cue(normalized, cue, negated) for cue in blocked):
            continue
        if any(_has_cue(normalized, cue, negated) for cue in cues):
            matched.append(key)
    return tuple(matched)


def extract_fluid_claim(normalized: str, negated: tuple[tuple[int, int], ...] = ()) -> FluidClaim:
    """Which fluid the writer says they are looking at."""
    hits = [
        fluid
        for fluid, cues in FLUID_CUES.items()
        if any(_has_cue(normalized, cue, negated) for cue in cues)
    ]
    if len(hits) == 1:
        return hits[0]
    return "unknown"


def extract_severity(normalized: str, negated: tuple[tuple[int, int], ...] = ()) -> SeverityHint:
    """How fast the fault presents: a drip, or continuous."""
    if any(_has_cue(normalized, cue, negated) for cue in SEVERITY_CUES["continuous"]):
        return "continuous"
    if any(_has_cue(normalized, cue, negated) for cue in SEVERITY_CUES["drip"]):
        return "drip"
    return "unknown"


def extract_recurrence(normalized: str, negated: tuple[tuple[int, int], ...] = ()) -> TriState:
    """Whether the fault is known to have happened before."""
    if any(_has_cue(normalized, cue, negated) for cue in RECURRENCE_DENIAL_CUES):
        return "no"
    if any(_has_cue(normalized, cue, negated) for cue in RECURRENCE_CUES):
        return "yes"
    return "unknown"


def extract_onset_conditions(
    normalized: str, negated: tuple[tuple[int, int], ...] = ()
) -> tuple[str, ...]:
    """The conditions the fault appears under, when stated."""
    onsets = list(match_cue_table(normalized, ONSET_CUES, negated, ONSET_EXCLUSIONS))
    if _AFTER_MINUTES.search(normalized) and "after_warmup" not in onsets:
        onsets.append("after_warmup")
    return tuple(onsets)


def extract_features(text: str) -> SymptomFeatures:
    """The full structured view of one piece of free text."""
    normalized = normalize_text(text)
    negated = negated_ranges(normalized)
    codes, codes_absent = extract_error_codes(text)
    return SymptomFeatures(
        error_codes=codes,
        error_codes_absent=codes_absent,
        fluid_claimed=extract_fluid_claim(normalized, negated),
        severity=extract_severity(normalized, negated),
        recurrence=extract_recurrence(normalized, negated),
        onset_conditions=extract_onset_conditions(normalized, negated),
        normalized_text=normalized,
    )


def features_for_case(case: Case) -> SymptomFeatures:
    """Features from the customer's side of a historical case."""
    return extract_features(case.customer_description)
