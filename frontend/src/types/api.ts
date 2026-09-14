// Shim for the design system's src/types/api.ts, which imports next-auth and its access guard.
// `Filters` is the only type the copied components reach for.
// the library's own shape, field for field. It allows a number because
// `calculatePreviousPeriod` returns epoch milliseconds, and the earlier hand-written
// version of this shim did not, which is the kind of drift a shim is supposed to prevent.
export interface DateRange {
  from: string | Date | number;
  to: string | Date | number;
  granularity?: "hourly" | "daily";
}

export interface Filters {
  dateRange?: DateRange;
  form?: string | null;
  status?: string | null;
  type?: unknown;
  scope?: string | null;
  category?: { slug?: string } | null;
  country?: string[];
  global?: boolean;
  [key: string]: unknown;
}
