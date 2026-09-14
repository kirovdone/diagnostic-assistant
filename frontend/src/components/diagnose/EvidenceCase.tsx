"use client";

// What one of the supporting case ids actually says.
//
// Opened inline rather than in a modal. The user is comparing it against the ranking
// above it, and a sheet that covers the ranking makes them close it to do the comparison.
// It is also the cheapest form of explanation the product has: the probability is a
// number nobody can check, and the three closed cases behind it are checkable in seconds.

import { DashboardCard } from "@/components/kit/dashboard/DashboardCard";
import { Badge } from "@/components/kit/ui/Badge";
import { Icon } from "@/components/kit/ui/Icon";
import useTranslation from "@/helpers/i18n/useTranslation";
import { Loader } from "@/components/kit/feedback/Loader";
import { File01Icon } from "@hugeicons/core-free-icons";
import type { EvidenceCase as EvidenceCaseData } from "@/types/diagnostics";

interface EvidenceCaseProps {
  caseId: string;
  data: EvidenceCaseData | null;
  onClose: () => void;
}

export function EvidenceCase({ caseId, data, onClose }: EvidenceCaseProps) {
  const { t } = useTranslation("common");
  return (
    <DashboardCard
      label={caseId}
      icon={<Icon icon={File01Icon} />}
      actions={[{ onClick: onClose, icon: <span aria-hidden>{t("Close")}</span> }]}
      className="h-auto"
    >
      {!data ? (
        <Loader cols={1} count={2} />
      ) : (
        <div className="space-y-3 text-sm">
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
    </DashboardCard>
  );
}
