"use client";

// Origin: the in-house design system, src/app/(app)/appContext.tsx. Same file, same path, same shape,
// trimmed to the two values this app has. the design system's version also carries the business,
// the subscription, the session and the chat registration, all of which belong to layers
// that do not exist here.
//
// The indirection is kept rather than replaced with props, because it is what lets a page
// own its own breadcrumb trail and its own header controls without the shell knowing the
// route table.
import { createContext, useContext } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Breadcrumb } from "@/types/components";

interface AppContextValue {
  setBreadcrumbs?: Dispatch<SetStateAction<Breadcrumb[]>>;
  setNavActions?: Dispatch<SetStateAction<ReactNode>>;
}

export const AppContext = createContext<AppContextValue>({});

export function useAppContext() {
  return useContext(AppContext);
}
