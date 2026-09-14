"use client";

// Origin: the in-house design system, src/hooks/common/useQueryParams.ts. Copied to keep this app native to the design system.
// Copied with no changes.
import { pushQuery } from "@/helpers/common/paramsToState";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const NONE: string[] = [];

export function useQueryParams(exclude: string[] = NONE) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getBase = useCallback(() => {
    const base: Record<string, string> = {};
    if (searchParams) {
      for (const [k, v] of searchParams.entries()) {
        if (!exclude.includes(k)) base[k] = v;
      }
    }
    return base;
  }, [searchParams, exclude]);

  const merge = useCallback(
    (patch: Record<string, unknown>) => {
      const base = getBase();
      const next: Record<string, unknown> = { ...base };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || (Array.isArray(v) && !v.length)) {
          delete next[k];
        } else {
          next[k] =
            typeof v === "object" && !(v instanceof Date)
              ? JSON.stringify(v)
              : v;
        }
      }
      pushQuery(router, pathname || "/", next);
    },
    [getBase, router, pathname],
  );

  const set = useCallback(
    (key: string, value: unknown) => merge({ [key]: value }),
    [merge],
  );

  const remove = useCallback((key: string) => merge({ [key]: null }), [merge]);

  return { merge, set, remove, getBase, searchParams };
}
