"use client";

// Origin: the in-house design system, src/components/filters/Filter.tsx.
//
// Reduced to the two variants this app has data for: `query` and `dateRange`. the design system's
// `status` branch and its `multiFilters` loop both render Select, which was deleted from
// this project when the equipment picker was cut, so copying them would have left two
// dead branches importing a component that is not here. Everything else - the popover
// Button, the form that commits the query on submit, the DatePicker lazy-loaded through
// next/dynamic, the shape of handleFilters - is the design system's, unchanged.
//
// Filter state lives in the query string, which is the design system's decision and the right one:
// a reviewer can send someone the URL of what they are looking at, and the back button
// undoes a filter.

import { Button } from "@/components/kit/ui/Button";
import dynamic from "next/dynamic";
import { Input } from "@/components/kit/ui/Input";
import { FILTER_QUERY_EXCLUDE } from "@/consts/filters";
import { useQueryParams } from "@/hooks/common/useQueryParams";
import { Icon } from "@/components/kit/ui/Icon";
import { FilterIcon } from "@hugeicons/core-free-icons";
import useTranslation from "@/helpers/i18n/useTranslation";
import { FC, useCallback, type ChangeEvent } from "react";
import type { FilterProps, FilterVariant } from "@/types/entities";

const DatePicker = dynamic(
  () => import("@/components/kit/fields/DatePicker").then((m) => m.DatePicker),
  { ssr: false, loading: () => null },
);

export const Filter: FC<FilterProps> = ({
  filters,
  setLoading,
  query = "",
  setQuery,
  variant = [],
}) => {
  const { t } = useTranslation("common");

  const { set } = useQueryParams(FILTER_QUERY_EXCLUDE);
  const { dateRange } = filters ?? {};

  const handleFilters = useCallback(
    (filterBy: string, value?: unknown) => {
      setLoading?.(true);
      set(filterBy, value ?? null);
    },
    [set, setLoading],
  );

  const has = useCallback((v: FilterVariant) => variant.includes(v), [variant]);

  return (
    <Button
      size="small"
      justifyContent="center"
      icon={<Icon icon={FilterIcon} />}
      justifyItems="end"
      content={
        <div className="space-y-3">
          {has("query") && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleFilters("q", query || undefined);
              }}
            >
              <Input
                label={t("Query")}
                name="search"
                size="small"
                value={query}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setQuery?.(e.target.value)
                }
                block
              />
            </form>
          )}
          {has("dateRange") && (
            <DatePicker
              range
              size="small"
              label={t("Date range")}
              className="w-full"
              dateFrom={dateRange?.from ? new Date(dateRange.from) : null}
              dateTo={dateRange?.to ? new Date(dateRange.to) : null}
              onRangeChange={({ dateFrom, dateTo }) =>
                handleFilters(
                  "dateRange",
                  dateFrom && dateTo
                    ? { from: dateFrom.toISOString(), to: dateTo.toISOString() }
                    : undefined,
                )
              }
            />
          )}
        </div>
      }
    />
  );
};
