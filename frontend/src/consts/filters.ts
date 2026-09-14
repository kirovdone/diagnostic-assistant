// Origin: the in-house design system, src/consts/filters.ts.
//
// Changed here: the order-status tables are dropped. They are the design system's commerce
// vocabulary -- unpaid, shipped, refunded -- and nothing in a service-case review queue has
// an order status, so leaving them in would describe a product this is not.
export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_RANGE_DAYS = 30;

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
