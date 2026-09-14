"""The root-cause taxonomy, versioned."""

from __future__ import annotations

from typing import Final

from pydantic import BaseModel, ConfigDict

TAXONOMY_VERSION: Final[str] = "2026-09-seed"


class Cause(BaseModel):
    """One root cause: the families it can occur on, and the parts it usually needs."""

    model_config = ConfigDict(frozen=True)

    cause_id: str
    labels: dict[str, str]
    typical_parts: tuple[str, ...]
    families: tuple[str, ...]
    fluid: str | None = None

    def label(self, language: str = "en") -> str:
        """The cause name in this language, falling back to English."""
        return self.labels.get(language, self.labels["en"])


FAMILY_CX: Final[str] = "Air Compressor CX"
FAMILY_AP: Final[str] = "Aerial Platform AP"
FAMILY_CH: Final[str] = "Water Chiller CH"

_CAUSES: Final[tuple[Cause, ...]] = (
    Cause(
        cause_id="CX.ELEC.CONTACTOR_FAILED",
        labels={
            "en": "Main contactor failed",
            "de": "Hauptschütz defekt",
            "fr": "Contacteur principal défaillant",
            "it": "Contattore principale guasto",
        },
        typical_parts=("CONTACTOR-M1",),
        families=(FAMILY_CX,),
    ),
    Cause(
        cause_id="CX.ELEC.GROUND_STRAP_LOOSE",
        labels={
            "en": "Loose or corroded ground strap",
            "de": "Masseband lose oder korrodiert",
            "fr": "Tresse de masse desserrée ou corrodée",
            "it": "Treccia di massa allentata o corrosa",
        },
        typical_parts=(),
        families=(FAMILY_CX,),
    ),
    Cause(
        cause_id="CX.ELEC.BATTERY_FAILED",
        labels={
            "en": "Battery failed",
            "de": "Batterie defekt",
            "fr": "Batterie défaillante",
            "it": "Batteria guasta",
        },
        typical_parts=("BATT-95AH",),
        families=(FAMILY_CX,),
    ),
    Cause(
        cause_id="CX.ELEC.ALTERNATOR_NOT_CHARGING",
        labels={
            "en": "Alternator not charging",
            "de": "Lichtmaschine lädt nicht",
            "fr": "Alternateur ne charge pas",
            "it": "Alternatore non carica",
        },
        typical_parts=("ALT-450",),
        families=(FAMILY_CX,),
    ),
    Cause(
        cause_id="CX.MECH.VALVE_PLATE_WORN",
        labels={
            "en": "Valve plate worn",
            "de": "Ventilplatte verschlissen",
            "fr": "Plaque à clapets usée",
            "it": "Piastra valvole usurata",
        },
        typical_parts=("VALVEPLATE-CX",),
        families=(FAMILY_CX,),
    ),
    Cause(
        cause_id="CX.MECH.REED_VALVE_BROKEN",
        labels={
            "en": "Reed valve broken",
            "de": "Lamellenventil gebrochen",
            "fr": "Clapet à lamelles cassé",
            "it": "Valvola a lamella rotta",
        },
        typical_parts=("REED-CX",),
        families=(FAMILY_CX,),
    ),
    Cause(
        cause_id="CX.MECH.CONROD_BEARING_WORN",
        labels={
            "en": "Connecting rod bearing worn",
            "de": "Pleuellager verschlissen",
            "fr": "Coussinet de bielle usé",
            "it": "Cuscinetto di biella usurato",
        },
        typical_parts=("BEARING-CR-CX",),
        families=(FAMILY_CX,),
    ),
    Cause(
        cause_id="CX.COOL.INTAKE_BLOCKED",
        labels={
            "en": "Intake screen blocked",
            "de": "Ansauggitter verstopft",
            "fr": "Grille d'admission obstruée",
            "it": "Griglia di aspirazione ostruita",
        },
        typical_parts=(),
        families=(FAMILY_CX,),
    ),
    Cause(
        cause_id="AP.HYD.BOOM_CYL_ROD_SEAL",
        labels={
            "en": "Boom cylinder rod seal leaking",
            "de": "Dichtung der Auslegerzylinderstange undicht",
            "fr": "Joint de tige du vérin de flèche fuit",
            "it": "Guarnizione stelo cilindro braccio perde",
        },
        typical_parts=("SEALKIT-BC-120",),
        families=(FAMILY_AP,),
        fluid="oil",
    ),
    Cause(
        cause_id="AP.HYD.BOOM_CYL_SCORED",
        labels={
            "en": "Boom cylinder scored",
            "de": "Auslegerzylinder verkratzt",
            "fr": "Vérin de flèche rayé",
            "it": "Cilindro braccio rigato",
        },
        typical_parts=("CYL-BOOM-120",),
        families=(FAMILY_AP,),
        fluid="oil",
    ),
    Cause(
        cause_id="CH.DRAIN.CONDENSATE_BLOCKED",
        labels={
            "en": "Condensate drain blocked",
            "de": "Kondensatablauf verstopft",
            "fr": "Évacuation des condensats obstruée",
            "it": "Scarico condensa ostruito",
        },
        typical_parts=(),
        families=(FAMILY_CH,),
        fluid="water",
    ),
    Cause(
        cause_id="CH.REFRIG.LEAK_SCHRADER",
        labels={
            "en": "Refrigerant leak at schrader valve",
            "de": "Kältemittelleck am Schraderventil",
            "fr": "Fuite de fluide frigorigène à la valve schrader",
            "it": "Perdita di refrigerante dalla valvola schrader",
        },
        typical_parts=("SCHRADER-SUC", "REFRIG-R410A"),
        families=(FAMILY_CH,),
    ),
    Cause(
        cause_id="CH.WATER.PUMP_SEAL_FAILED",
        labels={
            "en": "Water pump mechanical seal failed",
            "de": "Gleitringdichtung der Wasserpumpe defekt",
            "fr": "Garniture mécanique de la pompe à eau défaillante",
            "it": "Tenuta meccanica della pompa acqua guasta",
        },
        typical_parts=("SEAL-PMP-CH",),
        families=(FAMILY_CH,),
        fluid="water",
    ),
    Cause(
        cause_id="CH.WATER.FITTING_CORRODED",
        labels={
            "en": "Water fitting corroded",
            "de": "Wasseranschluss korrodiert",
            "fr": "Raccord d'eau corrodé",
            "it": "Raccordo acqua corroso",
        },
        typical_parts=("FITTING-22MM",),
        families=(FAMILY_CH,),
        fluid="water",
    ),
)

CAUSES_BY_ID: Final[dict[str, Cause]] = {cause.cause_id: cause for cause in _CAUSES}

PART_TO_CAUSE: Final[dict[str, str]] = {
    part: cause.cause_id for cause in _CAUSES for part in cause.typical_parts
}


def get_cause(cause_id: str) -> Cause | None:
    """The cause with this id, or None."""
    return CAUSES_BY_ID.get(cause_id)


def is_known_cause(cause_id: str) -> bool:
    """Whether the id is in the current taxonomy version."""
    return cause_id in CAUSES_BY_ID


def causes_for_family(family: str) -> tuple[Cause, ...]:
    """Every cause the taxonomy allows on this equipment family."""
    return tuple(cause for cause in _CAUSES if family in cause.families)


def all_causes() -> tuple[Cause, ...]:
    """The whole catalogue, in catalogue order."""
    return _CAUSES
