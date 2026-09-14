"use client";

// Origin: the in-house design system, src/components/ui/Table.tsx. Copied to keep this app native to the design system.
//
// Only change: @/components/ -> @/components/kit/; next-translate/useTranslation -> @/helpers/i18n/useTranslation.
import useTranslation from "@/helpers/i18n/useTranslation";
import { Loader } from "@/components/kit/feedback/Loader";
import { Root as CheckboxRoot, Indicator } from "@radix-ui/react-checkbox";
import { Button } from "@/components/kit/ui/Button";
import { NotFound } from "@/components/kit/feedback/NotFound";
import { cn } from "@/helpers/common/cn";
import {
  buildSortParams,
  type SortField,
} from "@/helpers/common/paramsToState";
import { useQueryParams } from "@/hooks/common/useQueryParams";
import { Icon } from "@/components/kit/ui/Icon";
import {
  Tick01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
} from "@hugeicons/core-free-icons";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

export function Checkbox({
  className,
  ...props
}: ComponentProps<typeof CheckboxRoot>) {
  return (
    <div className={cn("flex items-center gap-2 mb-2", className)}>
      <CheckboxRoot
        className={cn(
          "h-4 w-4 rounded-[4px] border border-borderDark bg-backgroundDark text-textDark",
          "data-[state=checked]:bg-accent data-[state=checked]:border-accent",
          "focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all",
        )}
        {...props}
      >
        <Indicator className="flex items-center justify-center text-current w-full h-full">
          <Icon icon={Tick01Icon} />
        </Indicator>
      </CheckboxRoot>
    </div>
  );
}

interface TableColumn {
  label: string;
  key: string;
  sortField?: string;
  className?: string;
  cellStyle?: CSSProperties;
}

interface TableDataRow {
  id: string | number;
  [key: string]: ReactNode;
}

interface SelectableConfig {
  selected: string[];
  onSelectAll: (checked: boolean) => void;
  onSelect: (id: string, checked: boolean) => void;
}

interface TableProps {
  columns: TableColumn[];
  rows: TableDataRow[];
  sorts?: SortField[];
  excludeParams?: string[];
  className?: string;
  selectable?: SelectableConfig;
  loading?: boolean;
}

export function Table({
  columns,
  rows,
  sorts = [],
  excludeParams = [],
  className,
  selectable,
  loading = false,
}: TableProps) {
  const { t } = useTranslation("common");
  const { merge } = useQueryParams([...excludeParams, "sortBy", "order"]);

  const allSelected = selectable
    ? rows.length > 0 &&
      rows.every((r) => selectable.selected.includes(r.id as string))
    : false;

  function handleSort(field: string) {
    const current = sorts.find((s) => s.field === field);
    const newSorts: SortField[] = [
      { field, order: current?.order === "asc" ? "desc" : "asc" },
    ];
    merge(buildSortParams(newSorts));
  }

  const th =
    "border-b border-borderDark text-sm px-4 py-3 text-left align-middle font-normal";
  const td = "border-b border-borderDark px-4 py-3 align-middle";
  const tr = "[&:last-child>td]:border-b-0";

  return (
    <div
      className={cn(
        "relative w-full overflow-auto scrollbar-app border border-borderDark bg-backgroundLight/50 rounded-xl shadow-none",
        className,
      )}
    >
      <table className="w-full caption-bottom border-collapse">
        <thead className="text-sm text-textLight">
          <tr className={tr}>
            {selectable && (
              <th
                className={cn(th, "w-[1rem]")}
                aria-label={t("Select all")}
                data-select-cell=""
              >
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(c) => selectable.onSelectAll(!!c)}
                  />
                </div>
              </th>
            )}
            {columns.map((col) => {
              const sortIndex = sorts.findIndex(
                (s) => s.field === col.sortField,
              );
              const isActive = sortIndex !== -1;
              const isAsc = sorts[sortIndex]?.order === "asc";
              return (
                <th key={col.key} className={cn(th, col.className)}>
                  {col.sortField ? (
                    <Button
                      variant="none"
                      icon={
                        isActive ? (
                          <span className="flex items-center">
                            {isAsc ? (
                              <Icon icon={ArrowUp01Icon} />
                            ) : (
                              <Icon icon={ArrowDown01Icon} />
                            )}
                            {sorts.length > 1 && (
                              <span className="text-xs ml-0.5">
                                {sortIndex + 1}
                              </span>
                            )}
                          </span>
                        ) : (
                          <Icon icon={ArrowDown01Icon} />
                        )
                      }
                      label={col.label}
                      onClick={() => handleSort(col.sortField!)}
                      className="text-textLight p-0 min-h-0 min-w-0 hover:text-text whitespace-nowrap flex-row-reverse"
                    />
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="text-sm font-normal">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className={tr}>
                {selectable && <td className={cn(td, "w-4")} />}
                {columns.map((col) => (
                  <td key={col.key} className={cn(td, col.className)}>
                    <Loader
                      cols={1}
                      count={1}
                      height={16}
                      className="rounded"
                    />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length > 0 ? (
            rows.map((row) => (
              <tr key={row.id} className={tr}>
                {selectable && (
                  <td className={cn(td, "w-4")} data-select-cell="">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={selectable.selected.includes(row.id as string)}
                        onCheckedChange={(c) =>
                          selectable.onSelect(row.id as string, !!c)
                        }
                      />
                    </div>
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(td, col.className)}
                    style={col.cellStyle}
                  >
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="p-2"
              >
                <NotFound />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
