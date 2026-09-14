"use client";

// Origin: the in-house design system, src/components/ui/ModalHeader.tsx. Copied to keep this app native to the design system.
//
// Only change: @/components/kit/ -> @/components/kit/the design system/; @/helpers/i18n/useTranslation -> @/helpers/i18n/useTranslation.

import {
  createContext,
  useContext,
  useEffect,
  type DependencyList,
  type ReactNode,
} from "react";

type SetHeaderActions = (actions: ReactNode) => void;

const ModalHeaderContext = createContext<SetHeaderActions | null>(null);

export const ModalHeaderProvider = ModalHeaderContext.Provider;

export const useModalHeaderActions = (
  actions: ReactNode,
  deps: DependencyList,
) => {
  const setHeaderActions = useContext(ModalHeaderContext);
  useEffect(() => {
    setHeaderActions?.(actions);
    return () => setHeaderActions?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHeaderActions, ...deps]);
};
