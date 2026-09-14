// Origin: the in-house design system, src/consts/filters.ts. Copied to keep this app native to the design system.
// Copied with no changes.
export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_RANGE_DAYS = 30;

const ORDER_STATUSES = [
  { name: "unpaid", manual: false, leavable: true },
  { name: "paid", manual: true, leavable: true },
  { name: "processing", manual: true, leavable: true },
  { name: "shipped", manual: true, leavable: true },
  { name: "delivered", manual: true, leavable: true },
  { name: "canceled", manual: true, leavable: true },
  { name: "refunding", manual: false, leavable: false },
  { name: "refunded", manual: false, leavable: false },
] as const;

export const ORDER_STATUS_NAMES = ORDER_STATUSES.map((s) => s.name);

export const MANUAL_ORDER_STATUSES = ORDER_STATUSES.filter((s) => s.manual).map(
  (s) => s.name,
);

export const LEAVABLE_ORDER_STATUSES = ORDER_STATUSES.filter(
  (s) => s.leavable,
).map((s) => s.name);

export const FILTER_QUERY_EXCLUDE = [
  "id",
  "businessId",
  "contactId",
  "customerId",
  "slug",
  "site",
  "page",
  "ordersPage",
  "requestsPage",
];

export const CONTENT_STATUS_NAMES = ["draft", "active", "inactive"] as const;

interface FilterableField {
  name: string;
}

export const FILTERABLE_FIELDS: FilterableField[] = [
  { name: "category" },
  { name: "dateRange" },
  { name: "category.slug" },
  { name: "status" },
  { name: "type" },
  { name: "country" },
  { name: "scope" },
  { name: "subcategories" },
  { name: "keywords" },
];
