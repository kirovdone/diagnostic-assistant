"use client";

// What one of the supporting case ids actually says, in a sheet from the right.
//
// It is the cheapest form of explanation the product has: the probability is a number
// nobody can check, and the closed cases behind it are checkable in seconds. A sheet
// rather than an inline card because the transcript is the thing being read — opening a
// case used to push the conversation down the page, and closing it pushed everything back
// up. The sheet leaves the chat where it was.
//
// Everything the case holds, in the order someone checking a ranking reads it: what the
// labeller concluded first, then the words it quoted to justify that, then the record
// itself. The evidence spans matter most — they are the only part of a label that can be
// checked against the text without trusting anything.
//
// Every field is read defensively even though the type says it is there. `types/diagnostics`
// is hand-mirrored from the FastAPI schema rather than generated from it, so the type is a
// claim about the wire and not a guarantee: a server one deploy behind sends the older,
// shorter shape, and a page that reads `.length` off a field it has not got dies on a
// mismatch that ought to be a missing paragraph.

import { Loader } from "@/components/kit/feedback/Loader";
import { Badge } from "@/components/kit/ui/Badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/kit/ui/Sheet";
import useTranslation from "@/helpers/i18n/useTranslation";
import type { EvidenceCase as EvidenceCaseData } from "@/types/diagnostics";

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  CONFIRMED: "success",
  PROVISIONAL: "warning",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs text-textLight">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

interface EvidenceCaseProps {
  caseId: string;
  data: EvidenceCaseData | null;
  onClose: () => void;
}

export function EvidenceCase({ caseId, data, onClose }: EvidenceCaseProps) {
  const { t, lang } = useTranslation("common");
  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="flex flex-col gap-4 overflow-y-auto p-4">
        <SheetHeader>
          <SheetTitle className="font-mono text-base font-medium">{caseId}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("A closed case behind one of the ranked causes")}
          </SheetDescription>
        </SheetHeader>

        {!data ? (
          <Loader cols={1} count={3} />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="neutral" label={data.equipment_type} />
              {data.equipment_family && (
                <Badge variant="neutral" label={data.equipment_family} />
              )}
              <Badge variant="neutral" label={data.language.toUpperCase()} />
              {data.outcome_status && (
                <Badge
                  variant={STATUS_TONE[data.outcome_status] ?? "neutral"}
                  label={t(data.outcome_status)}
                />
              )}
              {data.created_at && (
                <span className="text-xs text-textLight">
                  {new Date(data.created_at).toLocaleDateString(lang, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>

            {data.cause_label && (
              <Field label={t("Root cause the labeller assigned")}>
                <p className="font-medium">{data.cause_label}</p>
                <p className="mt-0.5 font-mono text-[11px] text-textLight">{data.cause_id}</p>
              </Field>
            )}

            {(data.evidence_spans?.length ?? 0) > 0 && (
              // The only part of a label that can be checked without trusting anything:
              // every span has to occur in the case text or the label was refused.
              <Field label={t("Quoted to justify it")}>
                <ul className="flex flex-col gap-1.5">
                  {data.evidence_spans!.map((span) => (
                    <li
                      key={span}
                      className="border-l-2 border-accent/50 pl-2.5 text-textLight italic"
                    >
                      {span}
                    </li>
                  ))}
                </ul>
              </Field>
            )}

            <Field label={t("What the customer said")}>
              <p>{data.customer_description}</p>
            </Field>

            {data.technician_notes && (
              <Field label={t("What the technician found")}>
                <p>{data.technician_notes}</p>
              </Field>
            )}

            <Field label={t("How it was resolved")}>
              <p>{data.resolution_text || t("Closed with no resolution text.")}</p>
            </Field>

            {/* A field the server did not send is not the same fact as a field it sent
                empty, and only the second one means no part was fitted. Rendering the
                absent case as "nothing was replaced" states something about the job that
                nobody recorded — next to a resolution reading "replaced cylinder seal kit"
                it reads as a contradiction in the data rather than a gap in the response. */}
            {data.parts_replaced && (
              <Field label={t("Parts fitted")}>
                {data.parts_replaced.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {data.parts_replaced.map((part) => (
                      <span key={part} className="font-mono text-[11px]">
                        {part}
                      </span>
                    ))}
                  </div>
                ) : (
                  // Worth stating rather than leaving blank: a cleaning job is a dispatch
                  // decision too, and a cause with no part is the one a van cannot prepare for.
                  <p className="text-textLight">{t("None — nothing was replaced")}</p>
                )}
              </Field>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
