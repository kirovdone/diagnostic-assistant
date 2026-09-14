"use client";

// What one of the supporting case ids actually says, in a sheet from the right.
//
// It is the cheapest form of explanation the product has: the probability is a number
// nobody can check, and the closed cases behind it are checkable in seconds. A sheet
// rather than an inline card because the transcript is the thing being read — opening a
// case used to push the conversation down the page, and closing it pushed everything back
// up. The sheet leaves the chat where it was, and the case sits beside it until dismissed.

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/kit/ui/Sheet";
import { Badge } from "@/components/kit/ui/Badge";
import { Loader } from "@/components/kit/feedback/Loader";
import useTranslation from "@/helpers/i18n/useTranslation";
import type { EvidenceCase as EvidenceCaseData } from "@/types/diagnostics";

interface EvidenceCaseProps {
  caseId: string;
  data: EvidenceCaseData | null;
  onClose: () => void;
}

export function EvidenceCase({ caseId, data, onClose }: EvidenceCaseProps) {
  const { t } = useTranslation("common");
  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="flex flex-col gap-4 overflow-y-auto p-4">
        <SheetHeader>
          <SheetTitle className="font-mono">{caseId}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("A closed case behind one of the ranked causes")}
          </SheetDescription>
        </SheetHeader>

        {!data ? (
          <Loader cols={1} count={2} />
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral" label={data.equipment_type} />
              <Badge variant="neutral" label={data.language.toUpperCase()} />
            </div>
            <div>
              <p className="mb-1 text-xs text-textLight">{t("What the customer said")}</p>
              <p>{data.customer_description}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-textLight">{t("How it was resolved")}</p>
              <p>{data.resolution_text ?? t("Closed with no resolution text.")}</p>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
