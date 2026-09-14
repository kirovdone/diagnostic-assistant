"use client";

// Flags, as the design system badges.
//
// The tone is the triage. UNMAPPED is destructive because it means the label did not
// survive validation and a human has to look. The contradiction flags are warnings: the
// label stands, and something about it disagrees with itself. NO_PART_FIX is neutral
// because it is usually just a cleaning job, and it is flagged only so that a run of them
// on one equipment type is visible.

import { Badge } from "@/components/kit/ui/Badge";
import useTranslation from "@/helpers/i18n/useTranslation";
import type { BadgeTone } from "@/types/components";
import type { OutcomeStatus } from "@/types/diagnostics";

const FLAG_TONE: Record<string, BadgeTone> = {
  UNMAPPED: "destructive",
  EVIDENCE_NOT_IN_TEXT: "destructive",
  PART_CAUSE_CONTRADICTION: "warning",
  CUSTOMER_SYMPTOM_MISMATCH: "warning",
  TEMPORARY_FIX: "warning",
  NULL_RESOLUTION: "warning",
  WHOLE_UNIT_SWAP: "neutral",
  NO_PART_FIX: "neutral",
};

export const STATUS_TONE: Record<OutcomeStatus, BadgeTone> = {
  CONFIRMED: "success",
  PROVISIONAL: "warning",
  NO_FAULT_FOUND: "neutral",
  NON_DIAGNOSTIC: "neutral",
  NON_TECHNICAL: "neutral",
};

// The enum name is not the copy. Spelling each one out is what makes it translatable,
// and it is also the only place the words a reviewer reads are chosen rather than derived
// from an identifier.
export const FLAG_LABEL: Record<string, string> = {
  UNMAPPED: "unmapped",
  EVIDENCE_NOT_IN_TEXT: "evidence not in text",
  PART_CAUSE_CONTRADICTION: "part contradicts cause",
  CUSTOMER_SYMPTOM_MISMATCH: "customer symptom mismatch",
  TEMPORARY_FIX: "temporary fix",
  NULL_RESOLUTION: "null resolution",
  WHOLE_UNIT_SWAP: "whole unit swap",
  NO_PART_FIX: "no part fix",
};

export const STATUS_LABEL: Record<OutcomeStatus, string> = {
  CONFIRMED: "confirmed",
  PROVISIONAL: "provisional",
  NO_FAULT_FOUND: "no fault found",
  NON_DIAGNOSTIC: "non diagnostic",
  NON_TECHNICAL: "non technical",
};

export function LabelFlags({ flags }: { flags: string[] }) {
  const { t } = useTranslation("common");
  if (flags.length === 0) return <span className="text-textLight">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((flag) => (
        <Badge
          key={flag}
          variant={FLAG_TONE[flag] ?? "neutral"}
          label={t(FLAG_LABEL[flag] ?? flag.replaceAll("_", " ").toLowerCase())}
        />
      ))}
    </div>
  );
}
