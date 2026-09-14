// Origin: the in-house design system, src/hooks/dashboard/useBreadcrumbs.ts. Copied unchanged.
import { useEffect } from "react";
import type { Breadcrumb } from "@/types/entities";

type SetBreadcrumbs = ((crumbs: Breadcrumb[]) => void) | undefined;

const crumbKey = (crumb: Breadcrumb): string => {
  const label = typeof crumb.label === "string" ? crumb.label : "";
  const items = (crumb.items ?? [])
    .map((item) => (typeof item.label === "string" ? item.label : ""))
    .join(",");
  return [label, crumb.link ?? "", items, crumb.itemsLoading ? "1" : ""].join(
    "|",
  );
};

export function useBreadcrumbs(
  setBreadcrumbs: SetBreadcrumbs,
  breadcrumbs: Breadcrumb[],
) {
  const key = breadcrumbs.map(crumbKey).join(">");
  useEffect(() => {
    if (setBreadcrumbs) setBreadcrumbs(breadcrumbs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setBreadcrumbs, key]);

  useEffect(() => {
    return () => {
      if (setBreadcrumbs) setBreadcrumbs([]);
    };
  }, [setBreadcrumbs]);
}
