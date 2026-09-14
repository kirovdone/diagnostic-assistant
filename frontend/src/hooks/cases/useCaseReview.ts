"use client";

// The closed-case corpus, loaded once and filtered in the browser.
//
// the design system's list pages share useResourceList, which owns the fetch, the query-string
// state and the filtering, so a page is only its columns. This is the same idea against a
// much smaller problem.
//
// Filtering happens here rather than on the server because the whole corpus is
// twenty-two rows and is already in memory. That is also why nothing passes the design system's
// `setLoading` into Filter and ActiveFilters: there is no request to wait for.

import { useEffect, useMemo, useState } from "react";

import { FLAG_LABEL } from "@/components/cases/LabelFlags";
import { paramsToState } from "@/helpers/common/paramsToState";
import { sendNotification } from "@/helpers/common/sendNotification";
import { ApiError, listCases } from "@/helpers/api/diagnosticAssist";
import useTranslation from "@/helpers/i18n/useTranslation";
import type { Filters } from "@/types/api";
import type { LabelRow } from "@/types/diagnostics";
import { endOfDay, startOfDay } from "date-fns";
import { useSearchParams } from "next/navigation";

// Lowercased and stripped of diacritics, which is the same fold the backend's normalize.py
// applies before it matches anything. Without it a reviewer hunting the German cases has
// to type the umlaut: "verflussiger" would miss "Verflüssiger", and the one person most
// likely to search this corpus is the one auditing the multilingual half of it.
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export interface CaseReview {
  /** Everything the backend returned, or null while it is still loading. */
  rows: LabelRow[] | null;
  /** What survives the filter. Empty, not null, before the first response. */
  visible: LabelRow[];
  loading: boolean;
  /** True when the filter is actually removing something. */
  filtered: boolean;
  total: number;
  /** Parsed out of the query string, in the shape Filter and ActiveFilters expect. */
  filters: Filters;
  /** The draft in the filter popover, which is not committed until it is submitted. */
  query: string;
  setQuery: (value: string) => void;
}

export function useCaseReview(): CaseReview {
  const { t } = useTranslation("common");
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<LabelRow[] | null>(null);

  // The committed search term is the one in the URL. The input inside the popover holds a
  // draft until it is submitted, so typing does not push a history entry per keystroke.
  // Re-seeding the draft when the URL moves is done during render rather than in an
  // effect, which is React's own answer for state derived from props.
  const searchTerm = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(searchTerm);
  const [seeded, setSeeded] = useState(searchTerm);
  if (seeded !== searchTerm) {
    setSeeded(searchTerm);
    setQuery(searchTerm);
  }

  // the library's own parser, so `dateRange` arrives as the object Filter wrote rather than
  // as a JSON string each page would have to parse a second way.
  const filters = useMemo(
    () => paramsToState(Object.fromEntries(searchParams.entries())).filters as Filters,
    [searchParams],
  );

  // Loads once. `t` is in the deps because the message is translated, and it changes
  // identity when the locale does; refetching the corpus on a language switch is one
  // request against a list that is already in memory, and the alternative is a stale
  // closure that toasts in the previous language.
  useEffect(() => {
    listCases()
      .then(setRows)
      .catch((caught: unknown) => {
        // 503 is the models being unreachable, which is a different problem from the
        // server being down, and telling someone to check port 8000 when the server
        // answered is how an afternoon gets lost.
        const status = caught instanceof ApiError ? caught.status : undefined;
        sendNotification(
          "error",
          status === 503
            ? t("The case list is unavailable: the service cannot reach its models.")
            : t("Could not reach the backend. Is it running on port 8000?"),
        );
      });
  }, [t]);

  // Two passes rather than one: the query decides which cases are in scope at all, and the
  // date range decides which window of those is on screen. Keeping them apart means a
  // caller can have the first without the second.
  const matched = useMemo(() => {
    const all = rows ?? [];
    const needle = fold(searchTerm);
    if (!needle) return all;
    return all.filter((row) => {
      // What a person wrote, plus the identifiers and the flag wording. The outcome
      // status is left out on purpose: it is a column you scan and a chart you read, and
      // substring-matching an enum is a trap - "no" would hit every NO_FAULT_FOUND row.
      // The flags are in because "unmapped" is the query a reviewer actually types, and
      // they are folded in both their raw form and their rendered wording so the match
      // works in any UI language.
      const haystack = [
        row.label.case_id,
        row.label.cause_id ?? "",
        row.cause_label ?? "",
        row.equipment_family,
        row.equipment_type,
        row.customer_description,
        row.technician_notes,
        row.resolution_text ?? "",
        ...row.parts_replaced,
        ...row.label.flags,
        ...row.label.flags.map((flag) => t(FLAG_LABEL[flag] ?? flag)),
      ].join(" ");
      return fold(haystack).includes(needle);
    });
  }, [rows, searchTerm, t]);

  const visible = useMemo(() => {
    const range = filters.dateRange;
    const from = range?.from ? startOfDay(new Date(range.from)) : null;
    const to = range?.to ? endOfDay(new Date(range.to)) : null;
    if (!from && !to) return matched;
    return matched.filter((row) => {
      const closed = new Date(row.created_at);
      if (from && closed < from) return false;
      if (to && closed > to) return false;
      return true;
    });
  }, [matched, filters]);

  const total = rows?.length ?? 0;

  return {
    rows,
    visible,
    loading: rows === null,
    filtered: visible.length !== total,
    total,
    filters,
    query,
    setQuery,
  };
}
