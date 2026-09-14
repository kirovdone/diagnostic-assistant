"use client";

// Origin: the in-house design system, src/components/ui/portalContainer.tsx. Copied to keep this app native to the design system.
// Copied with no changes.
import { createContext, useContext } from "react";

const PortalContainerContext = createContext<HTMLElement | null>(null);

export const PortalContainerProvider = PortalContainerContext.Provider;

export const usePortalContainer = (): HTMLElement | null =>
  useContext(PortalContainerContext);
