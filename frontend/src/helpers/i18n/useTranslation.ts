// next-translate's `useTranslation`, at next-translate's specifier.
//
// the design system's copied components import `useTranslation("common")` and use `{ t, lang }`.
// This returns exactly that, reading the catalogue the LocaleProvider loaded. the design system
// keys its translations on the English string, so a missing key renders the key, which is
// English, which is the correct fallback and needs no file for the default locale.
//
// Two of next-translate's behaviours are implemented because the UI needs them and
// because implementing them differently would make the catalogues incompatible with it:
//
//   t("Ranked from {{count}} closed cases", { count })   -> {{name}} interpolation
//   "x_one" / "x_other"                                  -> plural selection on `count`
//
// The namespace is accepted and ignored: there is one catalogue here, `common`, which is
// the only one the copied components ever ask for.
import { useLocale } from "@/hooks/i18n/LocaleProvider";
import { useCallback } from "react";

export type TranslateParams = Record<string, string | number>;

export function translate(
  catalogue: Record<string, string>,
  key: string,
  params?: TranslateParams,
): string {
  // next-translate looks for `key_one` and `key_other` before `key` when a count is
  // given. English lives in the key itself, so the plural forms are keys too and the
  // fallback below strips the suffix back to something readable.
  let resolved = key;
  if (params && typeof params.count === "number") {
    const plural = `${key}_${params.count === 1 ? "one" : "other"}`;
    if (catalogue[plural] !== undefined) resolved = plural;
  }
  const template = catalogue[resolved] ?? catalogue[key] ?? key;
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

export default function useTranslation(_namespace?: string) {
  const { lang, catalogue } = useLocale();
  // Memoised on the catalogue, because callers put `t` in effect dependency arrays. A new
  // function per render there is a fetch per render: the case list re-requested the whole
  // corpus in a loop, because each response re-rendered, which made a new `t`, which re-ran
  // the effect that had just fetched.
  const t = useCallback(
    (key: string, params?: TranslateParams): string => translate(catalogue, key, params),
    [catalogue],
  );
  return { t, lang };
}
