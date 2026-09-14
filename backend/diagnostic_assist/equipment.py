"""Working out which machine the text is about."""

from __future__ import annotations

import re
from typing import Final

from .models import EquipmentBasis, EquipmentGuess
from .normalize import match_cue_table, normalize_text

FAMILY_CUES: Final[dict[str, tuple[str, ...]]] = {
    "Air Compressor CX": (
        "compressor",
        "compressors",
        "kompressor",
        "verdichter",
        "compresseur",
        "compressore",
        "air end",
        "schraubenkompressor",
    ),
    "Aerial Platform AP": (
        "aerial platform",
        "aerial",
        "boom lift",
        "man lift",
        "cherry picker",
        "hubarbeitsbuhne",
        "hubarbeitsbuehne",
        "hubsteiger",
        "arbeitsbuhne",
        "arbeitsbuehne",
        "nacelle",
        "plateforme elevatrice",
        "piattaforma",
        "piattaforma aerea",
    ),
    "Water Chiller CH": (
        "chiller",
        "water chiller",
        "kaltwassersatz",
        "kaeltemaschine",
        "kaltemaschine",
        "kuehler",
        "kuhler",
        "refroidisseur",
        "groupe froid",
        "refrigeratore",
        "refrigerant",
        "kaeltemittel",
        "kaltemittel",
        "frigorigene",
        "refrigerante",
        "short cycling",
    ),
}

COMPONENT_CUES: Final[dict[str, tuple[str, ...]]] = {
    "Air Compressor CX": (
        "valve plate",
        "ventilplatte",
        "plaque a clapets",
        "intake screen",
        "intake filter",
        "ansaugfilter",
        "air filter",
        "cylinder 1",
        "cylinder 2",
        "zylinder",
        "crank",
        "no crank",
        "alternator",
        "lichtmaschine",
        "alternateur",
        "alternatore",
        "contactor",
        "hauptschutz",
        "hauptschuetz",
        "contacteur",
        "contattore",
        "ground strap",
        "masseband",
        "tresse de masse",
        "drive belt",
        "keilriemen",
        "discharge temp*",
    ),
    "Aerial Platform AP": (
        "boom",
        "boom cylinder",
        "ausleger",
        "auslegerzylinder",
        "fleche",
        "verin de fleche",
        "braccio",
        "rod seal",
        "stangendichtung",
        "outrigger",
        "abstutzung",
        "abstuetzung",
        "lift cylinder",
        "basket",
        "arbeitskorb",
    ),
    "Water Chiller CH": (
        "condensate",
        "condensate drain",
        "kondensat",
        "condensat",
        "condenser",
        "verfluessiger",
        "verflussiger",
        "condenseur",
        "evaporator",
        "verdampfer",
        "evaporateur",
        "chilled water",
        "cold water side",
        "hot water side",
        "cold side",
        "hot side",
        "refrigerant",
        "kaeltemittel",
        "kaltemittel",
        "water pump seal",
    ),
}


Catalogue = dict[str, tuple[str, ...]]
"""Equipment family -> the types under it. Built from the corpus, not hard-coded."""


def _type_pattern(equipment_type: str) -> re.Pattern[str]:
    """`CX-450` also matches `cx450` and `cx 450`, and nothing longer."""
    loose = re.escape(equipment_type).replace(r"\-", r"[-\s]?")
    return re.compile(rf"(?<![\w-]){loose}(?![\w-])", re.IGNORECASE)


def resolve(text: str, catalogue: Catalogue) -> EquipmentGuess:
    """The machine this text is about, or an empty guess if it does not say."""
    normalized = normalize_text(text)

    hits = [
        (family, equipment_type)
        for family, types in catalogue.items()
        for equipment_type in types
        if _type_pattern(equipment_type).search(normalized)
    ]
    families = tuple(dict.fromkeys(family for family, _ in hits))
    if len(families) == 1:
        family, equipment_type = hits[0]
        return EquipmentGuess(
            family=family,
            equipment_type=equipment_type,
            basis=EquipmentBasis.TYPE_CODE,
            matched_families=families,
        )
    if len(families) > 1:
        # "Replaced the CX-450 last year; now the CH-200 is leaking" names two machines. Taking
        # the first in catalogue order would scope the ranking to whichever family happens to be
        # declared first, so decline and ask instead.
        return EquipmentGuess(matched_families=families)

    for table, basis in (
        (FAMILY_CUES, EquipmentBasis.FAMILY_NAME),
        (COMPONENT_CUES, EquipmentBasis.COMPONENT),
    ):
        known = {family: cues for family, cues in table.items() if family in catalogue}
        matched = match_cue_table(normalized, known)
        if len(matched) == 1:
            return EquipmentGuess(family=matched[0], basis=basis, matched_families=matched)
        if len(matched) > 1:
            return EquipmentGuess(matched_families=matched)

    return EquipmentGuess()
