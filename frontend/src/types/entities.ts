// Shim for the design system's src/types/entities.ts.
//
// the design system's version re-exports its whole domain model, which reaches the MongoDB
// collections, next-auth and Stripe. The copied components only ever import their own
// prop types from this path, so the shim sits at the same specifier and re-exports just
// those. That is what keeps every copied component byte-identical apart from its import
// paths: nothing had to be edited to cut the dependency.
export * from "./common";
export * from "./components";
