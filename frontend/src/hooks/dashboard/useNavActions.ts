// Origin: the in-house design system, src/hooks/dashboard/useNavActions.ts. Copied unchanged.
import { type DependencyList, type ReactNode, useEffect } from "react";

type SetNavActions = ((actions: ReactNode) => void) | undefined;

export function useNavActions(
  setNavActions: SetNavActions,
  actions: ReactNode,
  deps: DependencyList,
) {
  useEffect(() => {
    if (setNavActions) setNavActions(actions);
    return () => {
      if (setNavActions) setNavActions(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNavActions, ...deps]);
}
