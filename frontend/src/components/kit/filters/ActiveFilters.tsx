"use client";

// Origin: the in-house design system, src/components/filters/ActiveFilters.tsx.
//
// Reduced alongside Filter: the design system's `status` case and its `multiFilters` option-name
// lookup are gone, because neither filter exists here. The chip markup, the clear and
// clear-all behaviour, and the rule that a chip appears only when the key is actually in
// the URL are the design system's, unchanged.
//
// This is the half of the pattern that matters: a filter you cannot see is a filter that
// makes the table lie. The reviewer looking at four rows needs to know whether that is the
// corpus or a search term someone left in a shared link.

import { Button } from "@/components/kit/ui/Button";
import { Icon } from "@/components/kit/ui/Icon";
import { FILTER_QUERY_EXCLUDE } from "@/consts/filters";
import { cn } from "@/helpers/common/cn";
import { useQueryParams } from "@/hooks/common/useQueryParams";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { formatDate } from "@/helpers/formatting/formatDate";
import useTranslation from "@/helpers/i18n/useTranslation";
import { useSearchParams } from "next/navigation";
import type { ActiveFiltersProps } from "@/types/entities";

type Translate = (key: string) => string;

const KEY_LABELS: Record<string, string> = {
  dateRange: "Date range",
  q: "Query",
};

const isDateRange = (v: unknown): v is { from: unknown; to: unknown } =>
  typeof v === "object" && v !== null && "from" in v && "to" in v;

const day = (value: unknown, lang: string): string => {
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? String(value) : formatDate(date, lang);
};

const describe = (value: unknown, t: Translate, lang: string): string => {
  if (isDateRange(value))
    return `${day(value.from, lang)} – ${day(value.to, lang)}`;
  if (typeof value === "boolean") return value ? t("Yes") : t("No");
  return String(value);
};

export function ActiveFilters({
  filters,
  setLoading,
  className,
}: ActiveFiltersProps) {
  const { t, lang } = useTranslation("common");
  const { set, merge } = useQueryParams(FILTER_QUERY_EXCLUDE);
  const searchParams = useSearchParams();
  const searchTerm = searchParams.get("q") ?? "";

  const chips: { key: string; label: string; value: string }[] = [];

  if (searchTerm) {
    chips.push({
      key: "q",
      label: t(KEY_LABELS.q),
      value: searchTerm,
    });
  }

  for (const [key, value] of Object.entries(filters ?? {})) {
    if (!searchParams.has(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    chips.push({
      key,
      label: t(KEY_LABELS[key] ?? key),
      value: describe(value, t, lang),
    });
  }

  if (chips.length === 0) return null;

  const clear = (key: string) => {
    setLoading?.(true);
    set(key, null);
  };

  const clearAll = () => {
    setLoading?.(true);
    merge(Object.fromEntries(chips.map((chip) => [chip.key, null])));
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.map((chip) => (
        <div
          key={chip.key}
          className="flex items-center gap-2 rounded-lg border border-borderDark bg-backgroundLight/60 py-1.5 pl-3 pr-1.5 text-sm text-text"
        >
          <span className="text-textLight">{chip.label}</span>
          <span className="max-w-50 truncate">{chip.value}</span>
          <Button
            size="xsmall"
            variant="danger"
            justifyContent="center"
            name={`${t("Remove")} ${chip.label}`}
            icon={<Icon icon={Cancel01Icon} />}
            onClick={() => clear(chip.key)}
          />
        </div>
      ))}
      {chips.length > 1 && (
        <Button
          size="small"
          variant="none"
          label={t("Clear all")}
          onClick={clearAll}
          className="text-sm text-textLight hover:text-text"
        />
      )}
    </div>
  );
}
