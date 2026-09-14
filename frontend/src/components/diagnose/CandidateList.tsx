"use client";

// The answer. One row per possible root cause, plus the row for the causes we do not
// have.
//
// Dense by default, because the first read happens while someone is on the phone: the
// cause, the number, and whether it needs a part, which is the only thing that turns a
// cause into a van load. The case ids read as links rather than buttons, because that is
// what they behave like: each one opens the closed case it names. What explains the number — the cause id, how many cases voted,
// which ones — is behind the accordion, because a dispatcher deciding what to load is not
// auditing the ranking and the person auditing it is not in a hurry.
//
// The share is the row's own background rather than a meter under it, which is how
// the design system's analytics rows carry one: the accent token faded to nothing across the
// width. A separate bar is a second object to read; a tinted row is the same
// object, read at a glance and ignorable when the number is what you came for.
//
// The "something else" row is drawn like the others on purpose. Showing it as a footnote,
// or leaving it out and normalising the rest to 100%, is the difference between a system
// that admits its taxonomy is incomplete and one that quietly pretends otherwise.

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/kit/ui/Accordion";
import { Badge } from "@/components/kit/ui/Badge";
import { Button } from "@/components/kit/ui/Button";
import { cn } from "@/helpers/common/cn";
import useTranslation from "@/helpers/i18n/useTranslation";
import type { Candidate } from "@/types/diagnostics";

// The header is the object: it carries the fill, the surface and the only shadow. What
// opens under it is not a second card, it is the rest of the same row. Sized like a small
// Button -- min-h-8, px-2 py-1 -- so a row and an option button are the same object.
const HEADER =
  "relative min-h-8 w-full overflow-hidden rounded-lg bg-backgroundDark px-2 py-1 text-left shadow-xs";

// Origin: the design system's HorizontalBars `barColor` default, which is how its analytics rows
// carry a share. That chart is not copied here; the gradient is.
const FILL =
  "linear-gradient(to right, color-mix(in srgb, var(--twc-accent) 8%, transparent), color-mix(in srgb, var(--twc-accent) 0%, transparent))";
const MUTED_FILL =
  "linear-gradient(to right, color-mix(in srgb, var(--twc-text) 5%, transparent), color-mix(in srgb, var(--twc-text) 0%, transparent))";

// Largest remainder, so a column of rounded percentages sums to exactly 100.
function apportion(values: number[]): number[] {
  const scaled = values.map((value) => Math.max(0, value) * 100);
  const floors = scaled.map(Math.floor);
  let left = 100 - floors.reduce((total, value) => total + value, 0);
  const order = scaled
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  const result = [...floors];
  for (const { index } of order) {
    if (left <= 0) break;
    result[index] += 1;
    left -= 1;
  }
  return result;
}

function Share({ value, muted = false }: { value: number; muted?: boolean }) {
  return (
    <span
      aria-hidden
      className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
      style={{
        width: `${Math.max(0, Math.min(1, value)) * 100}%`,
        background: muted ? MUTED_FILL : FILL,
      }}
    />
  );
}

interface CandidateListProps {
  candidates: Candidate[];
  otherProbability: number;
  onEvidenceClick: (caseId: string) => void;
}

export function CandidateList({
  candidates,
  otherProbability,
  onEvidenceClick,
}: CandidateListProps) {
  const { t } = useTranslation("common");

  // Rounding each number on its own made the column add up to 99 or 101, and a list whose
  // whole claim is that it is a distribution cannot be seen not to sum. Largest remainder
  // over every row including "something else": floor them all, then hand the leftover points
  // to whichever rows were cut hardest. Giving the remainder to the open-set row instead
  // would have been simpler and wrong -- that number is the one the design will not fudge.
  const percentages = apportion([...candidates.map((c) => c.probability), otherProbability]);
  const otherShown = percentages[percentages.length - 1];

  return (
    <div className="flex flex-col gap-1.5">
      <Accordion type="single" collapsible className="flex flex-col gap-1.5">
        {candidates.map((candidate, index) => (
          <AccordionItem key={candidate.cause_id} value={candidate.cause_id}>
            <AccordionTrigger className={HEADER}>
              <Share value={candidate.probability} />
              <span className="truncate text-sm font-medium">{candidate.label}</span>
              {candidate.typical_parts.length === 0 && (
                // Worth saying out loud even collapsed: a dispatcher needs to know the
                // most likely cause is a cleaning job, not a part.
                <Badge variant="neutral" label={t("No part")} />
              )}
              <span className="ml-auto pr-2 text-sm font-semibold tabular-nums">
                {percentages[index]}%
              </span>
            </AccordionTrigger>

            <AccordionContent>
              <div className="flex flex-col gap-2 px-2 pb-1 pt-2">
                {candidate.typical_parts.length > 0 && (
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[11px] text-textLight">{t("Usually needs")}</span>
                    <span className="font-mono text-[11px]">
                      {candidate.typical_parts.join(" · ")}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xs text-textLight">
                    {t("{{count}} similar cases", { count: candidate.n_supporting_cases })}
                  </span>
                  <span className="font-mono text-[11px] text-textLight">
                    {candidate.cause_id}
                  </span>
                </div>

                {candidate.evidence_case_ids.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[11px] text-textLight">{t("Because of")}</span>
                    {candidate.evidence_case_ids.map((caseId) => (
                      <Button
                        key={caseId}
                        size="xsmall"
                        variant="none"
                        label={caseId}
                        onClick={() => onEvidenceClick(caseId)}
                        className="h-auto px-0 font-mono text-[11px] text-accent hover:underline hover:underline-offset-2"
                      />
                    ))}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className={cn(HEADER, "shadow-none")}>
        <Share value={otherProbability} muted />
        <div className="relative flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-textLight">
            {t("Something else")}
          </span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-textLight">
            {otherShown}%
          </span>
          {/* Sits where the accordion chevron does above, so the numbers line up. */}
          <span className="w-3.75 shrink-0" aria-hidden />
        </div>
      </div>
    </div>
  );
}
