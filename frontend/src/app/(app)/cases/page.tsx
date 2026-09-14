"use client";

// Every closed case, with what the labeller made of it.
//
// This page exists because a labelling pipeline nobody can audit is a pipeline that is
// wrong for months. It is the only place the riskiest component in the system is visible
// case by case: what it decided, how sure it was, what it refused to label, and the words
// in the case that made it decide. The shape of the corpus - how much was thrown away,
// which flags are common - is a question for the corpus, not for this page; this page is
// the rows, and the filter is how you narrow them.
//
// It is called Cases rather than Labels because that is what a person on this screen is
// looking at. The label is what the system derived, and it is the seven columns after the
// case id; the row is a case.
//
// Filter state lives in the query string, which is the design system's pattern: the URL of what a
// reviewer is looking at can be pasted to someone else, and the back button undoes a
// filter rather than leaving the page.

import { Suspense } from "react";

import { LabelFlags, STATUS_LABEL, STATUS_TONE } from "@/components/cases/LabelFlags";
import { ActiveFilters } from "@/components/kit/filters/ActiveFilters";
import { Filter } from "@/components/kit/filters/Filter";
import { Badge } from "@/components/kit/ui/Badge";
import { Loader } from "@/components/kit/feedback/Loader";
import { Table } from "@/components/kit/ui/Table";
import { formatDate } from "@/helpers/formatting/formatDate";
import useTranslation from "@/helpers/i18n/useTranslation";
import { useCaseReview } from "@/hooks/cases/useCaseReview";
import { useBreadcrumbs } from "@/hooks/dashboard/useBreadcrumbs";
import { useNavActions } from "@/hooks/dashboard/useNavActions";

import { useAppContext } from "../appContext";

const COLUMNS = [
  // Labels are the English key. They go through t() at render, where the hook is.
  { label: "Case", key: "caseId", className: "w-24" },
  // On screen because it is filterable. A date range that cuts rows out of a table with
  // no date in it looks like a bug rather than a filter.
  { label: "Closed", key: "closed", className: "w-28" },
  { label: "Derived cause", key: "cause" },
  { label: "Outcome", key: "status", className: "w-36" },
  { label: "Conf.", key: "confidence", className: "w-20" },
  { label: "Weight", key: "weight", className: "w-20" },
  { label: "Flags", key: "flags" },
  { label: "Evidence", key: "evidence" },
];

export default function CasesPage() {
  const { t } = useTranslation("common");

  // The trail is the page title. The filter is a header control, the way the design system puts a
  // list page's controls next to its breadcrumb rather than inside the scrolling body, so
  // it stays reachable when the table is scrolled past its first screen; it is published
  // from CaseList, which is the component that holds the filter state.
  const { setBreadcrumbs } = useAppContext();
  useBreadcrumbs(setBreadcrumbs, [{ label: t("Cases"), link: "/cases" }]);

  // Everything below reads the query string. the design system's list pages set
  // dynamic = "force-dynamic" so useSearchParams is allowed at the top of the tree; a
  // static export cannot do that, so the whole filtered view sits behind one Suspense
  // boundary instead. The copied components stay untouched either way.
  return (
    <Suspense fallback={<Loader cols={1} count={8} />}>
      <CaseList />
    </Suspense>
  );
}

function CaseList() {
  const { t, lang } = useTranslation("common");
  const { setNavActions } = useAppContext();
  const { visible, loading, filters, query, setQuery } = useCaseReview();

  useNavActions(
    setNavActions,
    <Filter
      filters={filters}
      query={query}
      setQuery={setQuery}
      variant={["query", "dateRange"]}
    />,
    [filters, query, setQuery],
  );

  const rows = visible.map((row) => ({
    id: row.label.case_id,
    caseId: row.label.case_id,
    closed: <span className="whitespace-nowrap">{formatDate(row.created_at, lang)}</span>,
    cause: row.label.cause_id ? (
      <span>
        <span className="block text-sm">{row.cause_label}</span>
        <span className="font-mono text-[11px] text-textLight">{row.label.cause_id}</span>
      </span>
    ) : (
      <span className="text-textLight">{t("No cause. Nobody found one.")}</span>
    ),
    status: (
      <Badge
        variant={STATUS_TONE[row.label.outcome_status]}
        label={t(STATUS_LABEL[row.label.outcome_status])}
      />
    ),
    confidence: <span className="tabular-nums">{row.label.confidence.toFixed(2)}</span>,
    weight: (
      <span
        className={
          row.label.evidence_weight === 0 ? "tabular-nums text-textLight" : "tabular-nums"
        }
      >
        {row.label.evidence_weight.toFixed(2)}
      </span>
    ),
    flags: <LabelFlags flags={row.label.flags} />,
    evidence:
      row.label.evidence_spans.length > 0 ? (
        <span className="block max-w-md space-y-1">
          {row.label.evidence_spans.map((span) => (
            <span key={span} className="block text-xs text-textLight">
              &ldquo;{span}&rdquo;
            </span>
          ))}
        </span>
      ) : (
        <span className="text-textLight">-</span>
      ),
  }));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-3">
      {/* the design system puts the chips between the header and the content, and they are the half
          of the pattern that matters: without them a reviewer cannot tell whether four
          rows are the corpus or somebody else's search term in a shared link. */}
      <ActiveFilters filters={filters} />

      <Table
        columns={COLUMNS.map((column) => ({ ...column, label: t(column.label) }))}
        rows={rows}
        loading={loading}
      />
    </div>
  );
}
