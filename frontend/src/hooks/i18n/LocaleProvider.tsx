"use client";

// The locale, and the catalogue for it.
//
// the design system uses next-translate, which is a build plugin plus a server that can serve
// `/de/...`. This is a static export, so the plugin's route prefixing has nothing to
// prefix: there is no `/de/diagnose` to serve and generating a route tree per locale
// would multiply every page by seven for a UI of this size.
//
// What is kept is everything next-translate is to a component: `useTranslation("common")`
// at the same specifier, returning `{ t, lang }`, keyed on the English string exactly as
// the design system keys its own catalogues, falling back to the key when a string is missing. The
// catalogues are the design system's file layout too, `public/locales/<lang>/common.json`, fetched
// rather than imported so that adding a language is a file and not a build.
//
// The locale is persisted to `NEXT_LOCALE`, which is the cookie name next-translate uses
// and the one the design system's `switchLocale` writes, so a browser that has been to both sees
// one preference rather than two.

import { DEFAULT_LOCALE } from "@/consts/languages";
import { isLocale } from "@/helpers/common/resolveLocale";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export const LOCALE_COOKIE = "NEXT_LOCALE";

type Catalogue = Record<string, string>;

interface LocaleValue {
  lang: string;
  setLang: (lang: string) => void;
  catalogue: Catalogue;
}

const LocaleContext = createContext<LocaleValue>({
  lang: DEFAULT_LOCALE,
  setLang: () => {},
  catalogue: {},
});

// The cookie is an external store, so it is read through the API React provides for one.
// The alternative is `useState` plus an effect that corrects it on mount, which is both a
// cascading render and a hydration mismatch waiting for the first user who has chosen a
// language: the server has no cookie and renders English, the browser has one and renders
// German. `getServerSnapshot` is what makes the two agree and React re-render once.
const listeners = new Set<() => void>();

const readCookie = (name: string): string | undefined =>
  document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];

const subscribe = (onChange: () => void): (() => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

const readLocale = (): string => {
  const stored = readCookie(LOCALE_COOKIE);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
};

const serverLocale = (): string => DEFAULT_LOCALE;

export function LocaleProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, readLocale, serverLocale);
  const [catalogue, setCatalogue] = useState<Catalogue>({});

  useEffect(() => {
    let cancelled = false;
    // English is the key set: there is no file to fetch, and a missing key already falls
    // back to the key. The resolved promise keeps both paths off the synchronous render.
    const loading: Promise<Catalogue> =
      lang === DEFAULT_LOCALE
        ? Promise.resolve({})
        : fetch(`/locales/${lang}/common.json`)
            .then((response) => (response.ok ? (response.json() as Promise<Catalogue>) : {}))
            // A missing or broken catalogue leaves every string at its English key, which
            // is what a missing key does anyway. Degraded, never blank.
            .catch(() => ({}));

    void loading.then((loaded) => {
      if (!cancelled) setCatalogue(loaded);
    });

    return () => {
      cancelled = true;
    };
  }, [lang]);

  const setLang = useCallback((next: string) => {
    if (!isLocale(next)) return;
    // the library's own cookie, written exactly as its switchLocale writes it.
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    listeners.forEach((listener) => listener());
  }, []);

  const value = useMemo<LocaleValue>(
    () => ({ lang, setLang, catalogue }),
    [lang, setLang, catalogue],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  return useContext(LocaleContext);
}
