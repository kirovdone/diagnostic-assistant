"use client";

// Origin: the in-house design system, src/hooks/common/useSidebarResize.ts.
//
// Changed here: every localStorage access is wrapped. The design system runs behind a login
// on managed browsers; this is a static export anyone can open, and a browser with site data
// blocked throws on the first read. That read is in a layout effect of the app shell, so the
// exception took the whole signed-in UI down to keep a remembered sidebar width.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const MENU_WIDTH = 256;
const CHAT_WIDTH = 400;
const MIN_CHAT_WIDTH = 320;
const MAX_CHAT_WIDTH = 720;
const CHAT_WIDTH_KEY = "sidebarChatWidth";

const clampChatWidth = (value: number): number =>
  Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, Math.round(value)));

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Storage is a convenience here, never a dependency: a blocked or full store loses the
// preference and changes nothing else.
const remember = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nothing to do.
  }
};

export const setSidebarCollapsed = (collapsed: boolean) => {
  window.dispatchEvent(
    new CustomEvent("sidebarCollapse", { detail: { collapsed } }),
  );
};

export const useSidebarResize = (isChatMode: boolean) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [chatWidth, setChatWidth] = useState(CHAT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  const width = isChatMode ? chatWidth : MENU_WIDTH;

  useIsomorphicLayoutEffect(() => {
    try {
      const savedCollapsed = localStorage.getItem("sidebarCollapsed");
      if (savedCollapsed !== null) setIsCollapsed(JSON.parse(savedCollapsed));
      const savedWidth = Number(localStorage.getItem(CHAT_WIDTH_KEY));
      if (Number.isFinite(savedWidth) && savedWidth > 0) setChatWidth(clampChatWidth(savedWidth));
    } catch {
      // Defaults are fine; the preference simply is not remembered.
    }
    const raf = requestAnimationFrame(() => setHasMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const handler = (e: Event) =>
      setIsCollapsed((e as CustomEvent).detail.collapsed);
    window.addEventListener("sidebarCollapse", handler);
    return () => window.removeEventListener("sidebarCollapse", handler);
  }, []);

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      remember("sidebarCollapsed", JSON.stringify(next));
      return next;
    });
  }, []);

  const startResize = useCallback(
    (e: ReactPointerEvent) => {
      if (!isChatMode) return;
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = chatWidth;
      setIsResizing(true);

      const onMove = (move: PointerEvent) => {
        setChatWidth(clampChatWidth(startWidth + (move.clientX - startX)));
      };
      const onUp = () => {
        setIsResizing(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setChatWidth((current) => {
          remember(CHAT_WIDTH_KEY, String(current));
          return current;
        });
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [isChatMode, chatWidth],
  );

  return {
    isCollapsed,
    width,
    hasMounted,
    toggle,
    canResize: isChatMode,
    isResizing,
    startResize,
  };
};
