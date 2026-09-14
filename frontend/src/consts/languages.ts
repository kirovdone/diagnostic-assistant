// Origin: the in-house design system, src/consts/languages.ts.
//
// Same shape, same exports, one change: the locale list. the design system ships seven because its
// customers are in seven markets. This ships the four the corpus is written in, which are
// the four the taxonomy carries a cause label for, so every language offered here
// translates the whole answer and not just the chrome around it. Offering Spanish would
// mean a Spanish menu over English cause names, which is worse than not offering it.
export const LOCALES = [
  { code: "en", name: "English", english: "English" },
  { code: "fr", name: "Français", english: "French" },
  { code: "de", name: "Deutsch", english: "German" },
  { code: "it", name: "Italiano", english: "Italian" },
] as const;

export const DEFAULT_LOCALE: (typeof LOCALES)[number]["code"] = "en";

export const LOCALE_CODES = LOCALES.map((l) => l.code);

export const LANGUAGES = LOCALES.map(({ code, name }) => ({
  name,
  locale: code,
}));
