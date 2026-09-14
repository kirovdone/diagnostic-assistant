"use client";

// The end of the session, and the only ground truth this product ever produces.
//
// Everything measurable about the system traces back to this button. Offline evaluation
// compares the labeller to a gold set someone had to write by hand; this compares the
// ranking to what the machine actually turned out to be, recorded by the person who found
// out. "None of these" matters as much as the rest: it is the direct measurement of
// whether the "something else" share is honest, so it is a full-width button rather than
// a link at the bottom.
//
// Rendered as the last thing the assistant says rather than as a card, because it is a
// question in the conversation and not a panel to go and find. Same width as the ranking
// above it and the options before it: everything the assistant puts up to be acted on
// lines up in one column.

import { Button } from "@/components/kit/ui/Button";
import useTranslation from "@/helpers/i18n/useTranslation";
import type { Candidate } from "@/types/diagnostics";

interface ConfirmCauseProps {
  candidates: Candidate[];
  pending: boolean;
  onConfirm: (causeId: string | null) => void;
}

export function ConfirmCause({ candidates, pending, onConfirm }: ConfirmCauseProps) {
  const { t } = useTranslation("common");
  return (
    <div className="flex max-w-sm flex-col gap-2 text-sm">
      <p className="font-medium text-text">{t("What was it actually?")}</p>
      <p className="text-textLight">
        {t("Recorded against this session. It is what the next ranking learns from.")}
      </p>
      <div className="mt-1 flex flex-col gap-2">
        {candidates.map((candidate) => (
          <Button
            key={candidate.cause_id}
            label={candidate.label}
            size="small"
            variant="solid"
            block
            justifyContent="start"
            disabled={pending}
            className="h-auto whitespace-normal py-1.5 text-left [&>span]:overflow-visible [&>span]:whitespace-normal"
            onClick={() => onConfirm(candidate.cause_id)}
          />
        ))}
        <Button
          label={t("None of these")}
          size="small"
          variant="solid"
          block
          justifyContent="start"
          disabled={pending}
          className="h-auto whitespace-normal py-1.5 text-left [&>span]:overflow-visible [&>span]:whitespace-normal"
          onClick={() => onConfirm(null)}
        />
      </div>
    </div>
  );
}
