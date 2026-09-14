// What the assistant says about a ranking, as a sentence.
//
// The same facts used to be badges and chips: a neutral pill for the machine, a toned pill
// for the fallback level, a muted caption for the case count. That is a dashboard reading
// of them. In a conversation the machine it settled on and how thin the evidence is are
// things the assistant says, and saying them is also the only way the caveat arrives
// before the numbers rather than beside them.
//
// Built from keys rather than from string concatenation, because a sentence assembled from
// translated fragments is a sentence in no language: German puts the clause the other way
// round and French needs the article. Each shape is one key with named parameters, so a
// translator gets a whole sentence to move around.

import type { TranslateParams } from "@/helpers/i18n/useTranslation";
import type { EquipmentBasis, FallbackLevel, SessionView } from "@/types/diagnostics";

type Translate = (key: string, params?: TranslateParams) => string;

const BASIS: Record<EquipmentBasis, string> = {
  TYPE_CODE: "{{machine}}, from the type code you gave.",
  FAMILY_NAME: "{{machine}}, from the machine you named.",
  COMPONENT: "{{machine}}, from a part only that family has.",
  STATED: "{{machine}}, because you told me.",
};

// How far the search had to widen, and what that costs the answer. Two shapes each, so a
// translator is never asked to agree a count with a clause written somewhere else.
const SCOPE: Record<FallbackLevel, { plain: string; thin: string }> = {
  type: {
    plain: "Ranked from {{count}} closed cases of this exact model.",
    thin: "Ranked from {{count}} closed cases of this exact model — thin evidence, so read it as a shortlist.",
  },
  family: {
    plain: "Ranked from {{count}} closed cases across the family rather than this exact model.",
    thin: "Ranked from {{count}} closed cases across the family rather than this exact model — thin evidence, so read it as a shortlist.",
  },
  global: {
    plain: "Ranked from {{count}} closed cases from anywhere in the corpus, which is as wide as it gets.",
    thin: "Ranked from {{count}} closed cases from anywhere in the corpus, which is as wide as it gets — thin evidence, so read it as a shortlist.",
  },
};

export function narrateMachine(t: Translate, view: SessionView): string | null {
  if (!view.equipment_family || !view.equipment_basis) return null;
  const machine = view.equipment_type
    ? `${view.equipment_family} (${view.equipment_type})`
    : view.equipment_family;
  return t(BASIS[view.equipment_basis], { machine });
}

export function narrateEvidence(t: Translate, view: SessionView): string | null {
  if (!view.equipment_family) return null;
  const { n_similar_cases: count, fallback_level: level, degraded } = view.ranking;
  if (count === 0) {
    return t("Nothing comparable has been closed on it, so there is nothing to rank yet.");
  }
  return t(SCOPE[level][degraded ? "thin" : "plain"], { count });
}
