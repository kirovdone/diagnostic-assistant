// Origin: the in-house design system, src/helpers/common/paramsToState.ts. Copied to keep this app native to the design system.
// Copied with no changes.
import { FILTERABLE_FIELDS } from "@/consts/filters";
import { safeParseJson } from "@/helpers/common/isJson";

export interface SortField {
  field: string;
  order: "asc" | "desc";
}

type Params = Record<string, unknown>;
type State = {
  sortings: Record<string, unknown>;
  sorts: SortField[];
  filters: Record<string, unknown>;
  searchTerm: string;
  page: number;
  id?: string;
  [key: string]: unknown;
};

function parseSorts(
  sortBy?: string | string[],
  order?: string | string[],
): SortField[] {
  if (!sortBy) return [];
  const fields = (
    Array.isArray(sortBy) ? sortBy : String(sortBy).split(",")
  ).map((f) => String(f).trim());
  const orders = Array.isArray(order)
    ? order.map((o) => String(o).trim())
    : typeof order === "string"
      ? order.split(",").map((o) => o.trim())
      : [];
  if (!fields.length || !fields[0]) return [];
  return fields.map((field, i) => ({
    field,
    order: (orders[i] || orders[0] || "asc") as "asc" | "desc",
  }));
}

export function pushQuery(
  router: { push: (url: string, opts?: { scroll?: boolean }) => void },
  pathname: string,
  query: Record<string, unknown>,
) {
  const qs = new URLSearchParams(
    Object.entries(query).map(([k, v]) => [k, String(v)]),
  ).toString();
  router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
}

export function buildSortParams(sorts: SortField[]) {
  if (sorts.length === 0) return {};
  return {
    sortBy: sorts.map((s) => s.field).join(","),
    order: sorts.map((s) => s.order).join(","),
  };
}

const applyParam = (state: State, key: string, value: unknown): void => {
  if (FILTERABLE_FIELDS.some((f) => f.name === key)) {
    state.filters[key] = value;
    return;
  }
  if (key === "q") {
    state.searchTerm = value as string;
    return;
  }
  if (key === "_id") {
    state.id = value as string;
    return;
  }
  if (key === "order" || key === "sortBy") {
    state.sortings[key] = value;
    return;
  }
  if (key === "page") {
    state.page = Number(value);
    return;
  }
  state[key] = value;
};

export const paramsToState = (
  params: Params,
  defaultSortings: Record<string, unknown> = {},
  defaultFilters: Record<string, unknown> = {},
): State => {
  const state: State = {
    sortings: { ...defaultSortings },
    sorts: [],
    filters: { ...defaultFilters },
    searchTerm: "",
    page: 1,
  };

  for (const [key, raw] of Object.entries(params)) {
    const value = typeof raw === "string" ? (safeParseJson(raw) ?? raw) : raw;
    applyParam(state, key, value);
  }

  const sortings = state.sortings as { sortBy?: string; order?: string };
  const defaults = defaultSortings as { sortBy?: string; order?: string };
  state.sorts = parseSorts(
    sortings.sortBy ?? defaults.sortBy,
    sortings.order ?? defaults.order,
  );

  return state;
};
