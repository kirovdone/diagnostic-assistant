"use client";

import { useMemo, useState, type ReactNode } from "react";

import { AppNavigation } from "@/components/layout/AppNavigation";
import { RequireAuth } from "@/components/layout/RequireAuth";
import type { Breadcrumb } from "@/types/components";

import { AppContext } from "./appContext";

// the design system groups its authenticated surface under a route group so the shell wraps every
// page inside it without appearing in the URL. Same idea here, minus the auth.
//
// The layout owns the breadcrumb trail and the header controls, and hands both setters
// down through AppContext, the way the library's own (app)/layout.tsx does, so a page names
// its own place in the hierarchy and the shell stays ignorant of the route table.
export default function AppLayout({ children }: { children: ReactNode }) {
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [navActions, setNavActions] = useState<ReactNode>(null);
  const value = useMemo(() => ({ setBreadcrumbs, setNavActions }), []);

  return (
    <AppContext.Provider value={value}>
      <AppNavigation breadcrumbs={breadcrumbs} navActions={navActions}>
        {/* Inside the shell rather than around it, so a signed-out user still gets the
            rail and the header. the design system does the same: the chrome is the product, and
            a login form on a blank page reads as a different site. */}
        <RequireAuth>{children}</RequireAuth>
      </AppNavigation>
    </AppContext.Provider>
  );
}
