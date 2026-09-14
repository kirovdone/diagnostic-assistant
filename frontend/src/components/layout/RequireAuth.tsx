"use client";

// The gate in front of everything that reads case data.
//
// A closed case carries a customer's site, their complaint and what a technician found
// inside their machine. The backend refuses all of it without a token, so this is not
// the security boundary: it is the reason a signed-out user lands on /login instead of
// on a shell full of failed requests.

import { Loader } from "@/components/kit/feedback/Loader";
import { useAuth } from "@/hooks/auth/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Skeleton while the held token is checked, and again for the frame between deciding
  // there is no user and the router arriving at /login. A flash of anything else in
  // either window is worse than a beat of nothing.
  if (loading || !user) {
    return (
      <div className="mx-auto w-full max-w-sm p-5">
        <Loader cols={1} count={3} />
      </div>
    );
  }

  return <>{children}</>;
}
