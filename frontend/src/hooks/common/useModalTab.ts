// Origin: the in-house design system, src/hooks/common/useModalTab.ts. Copied unchanged.
"use client";

import { useCallback, useSyncExternalStore } from "react";

export interface ModalTabStore<T extends string> {
  subscribe: (listener: () => void) => () => void;
  get: () => T | null;
  set: (next: T | null) => void;
}

export const createModalTabStore = <T extends string>(): ModalTabStore<T> => {
  let tab: T | null = null;
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get: () => tab,
    set: (next) => {
      if (tab === next) return;
      tab = next;
      listeners.forEach((listener) => listener());
    },
  };
};

const getServerTab = () => null;

export const useModalTab = <T extends string>(
  store: ModalTabStore<T>,
  defaultTab: T,
) => {
  const tab = useSyncExternalStore(store.subscribe, store.get, getServerTab);
  const open = useCallback(
    (next: T = defaultTab) => store.set(next),
    [store, defaultTab],
  );
  const close = useCallback(() => store.set(null), [store]);
  return { tab, isOpen: tab !== null, open, close };
};
