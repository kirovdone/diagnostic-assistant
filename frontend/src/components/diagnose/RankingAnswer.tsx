"use client";

// The ranking, rendered inside the assistant's message rather than in a panel beside it.
//
// It is part of the answer because that is what it is: the user described a fault and
// this is the reply. Narrower than the column, because a list of five short rows set to
// full width leaves the number a long way from the name it belongs to.
//
// The reserved "something else" share stays in the list rather than being a footnote,
// because it is the one row that says the system might not have the answer, and a
// footnote is what a reader skips.

import { CandidateList } from "@/components/diagnose/CandidateList";
import { narrateEvidence, narrateMachine } from "@/helpers/diagnostics/narrate";
import useTranslation from "@/helpers/i18n/useTranslation";
import type { SessionView } from "@/types/diagnostics";

interface RankingAnswerProps {
  view: SessionView;
  onEvidenceClick: (caseId: string) => void;
}

export function RankingAnswer({ view, onEvidenceClick }: RankingAnswerProps) {
  const { t } = useTranslation("common");
  const machineKnown = Boolean(view.equipment_family);

  // Nothing is ranked until the machine is known. A search across every family would
  // return real, ranked, plausible neighbours about a machine this customer may not own.
  if (!machineKnown) {
    return (
      <p className="text-sm text-textLight">
        {t(
          "I do not know which machine this is yet, so there is nothing worth ranking: a search across every machine would be real, ranked, and about something you may not own.",
        )}
      </p>
    );
  }

  const machine = narrateMachine(t, view);
  const evidence = narrateEvidence(t, view);

  return (
    <div className="flex max-w-sm flex-col gap-2.5">
      {(machine || evidence) && (
        <p className="text-textLight">{[machine, evidence].filter(Boolean).join(" ")}</p>
      )}
      <CandidateList
        candidates={view.ranking.candidates}
        otherProbability={view.ranking.other_probability}
        onEvidenceClick={onEvidenceClick}
      />
    </div>
  );
}
