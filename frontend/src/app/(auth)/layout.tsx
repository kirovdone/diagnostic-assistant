"use client";

// Origin: the in-house design system, src/app/(auth)/layout.tsx.
//
// Same route group, same job: the pages that exist before there is a user, outside the
// app shell. the design system's also mounts its landing-page analytics scripts, which do not
// exist here. The rest is its markup, including `suppressHydrationWarning`, which it
// needs for the same reason this does: the theme resolves on the client.

import { ContextLayout } from "@/context";
import { getTheme } from "@/helpers/common/theme";
import type { ContextProps } from "@/types/components";
import { useContext, type ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { theme } = useContext(ContextLayout) as ContextProps;
  return (
    <main
      className="relative font-base h-full min-h-screen overflow-hidden text-base text-text bg-background"
      data-theme={getTheme(theme)}
      suppressHydrationWarning
    >
      {children}
    </main>
  );
}
