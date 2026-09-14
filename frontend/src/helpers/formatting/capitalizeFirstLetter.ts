// Origin: the in-house design system, src/helpers/formatting/capitalizeFirstLetter.ts. Copied to keep this app native to the design system.
// Copied with no changes.
export const capitalizeFirstLetter = (
  value?: string | null,
): string | undefined => {
  if (!value || typeof value !== "string") return value ?? undefined;
  return value.charAt(0).toUpperCase() + value.slice(1);
};
