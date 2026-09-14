"use client";

// Origin: the in-house design system, src/context/index.tsx. Copied to keep this app native to the design system.
//
// Copied with no changes. The theme preference is written to a cookie and stamped on
// the root element as data-theme, which is what globals.css reads, so the two palettes
// that came with the stylesheet work here without a line of new CSS.

import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { ContextProps, ThemeMode, ThemePreference } from "@/types/entities";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const ContextLayout = createContext<ContextProps | null>(null);

const writePreference = (mode: ThemePreference) => {
  document.cookie = `theme=${mode};path=/;max-age=31536000;samesite=lax`;
};

const systemTheme = (): ThemeMode =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

const resolvePreference = (mode: ThemePreference): ThemeMode =>
  mode === "system" ? systemTheme() : mode;

const Context = ({
  children,
  initialTheme = "system",
}: {
  children: ReactNode;
  initialTheme?: ThemePreference;
}) => {
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(
    initialTheme === "dark" ? "dark" : "light",
  );
  const [themePreference, setThemePreference] =
    useState<ThemePreference>(initialTheme);

  const setThemeMode = useCallback((mode: ThemePreference) => {
    setThemePreference(mode);
    writePreference(mode);
  }, []);

  useIsomorphicLayoutEffect(() => {
    setTheme(resolvePreference(themePreference));
  }, [themePreference]);

  useIsomorphicLayoutEffect(() => {
    if (themePreference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themePreference]);

  useIsomorphicLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", themePreference);
  }, [themePreference]);

  const value = useMemo<ContextProps>(
    () => ({
      loading,
      setLoading,
      authLoading,
      setAuthLoading,
      theme,
      themePreference,
      setThemeMode,
    }),
    [loading, authLoading, theme, themePreference, setThemeMode],
  );

  return (
    <ContextLayout.Provider value={value}>{children}</ContextLayout.Provider>
  );
};

export { Context, ContextLayout };
