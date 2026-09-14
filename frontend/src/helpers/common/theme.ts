// Origin: the in-house design system, src/helpers/common/theme.ts. Copied unchanged.
export const getTheme = (theme?: string): "light" | "dark" =>
  theme === "dark" ? "dark" : "light";
