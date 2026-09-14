// Origin: the in-house design system, src/helpers/common/resolveLocale.ts.
//
// Only change: the locale list, for the reason in consts/languages.ts.
import { notFound } from "next/navigation";

// Trimmed to the corpus's four, for the reason in consts/languages.ts.
export const LOCALES = ["en", "fr", "de", "it"] as const;
type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocaleFromParams(value: string | undefined): Locale {
  if (!isLocale(value)) notFound();
  return value;
}

export function resolveLocaleFromCookie(value: string | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function copyFor<T>(translations: Record<string, T>, locale: string): T {
  return translations[locale] ?? translations[DEFAULT_LOCALE];
}

export function localizedPath(path: string, locale: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  if (path === "/") return `/${locale}`;
  return `/${locale}${path}`;
}
