// Shim for the design system's src/types/rendering.ts, which describes its website node tree.
// `RichText` is the only type the copied components reach for.
export interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  color?: string;
  link?: string;
}

export type RichText = string | Span[];
