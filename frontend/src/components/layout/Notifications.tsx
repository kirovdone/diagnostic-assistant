"use client";

// The toast host.
//
// Origin: the in-house design system, the `<Sonner>` element at the bottom of its (app)/layout.tsx, copied
// with its position and its whole toastOptions block, so a toast here is the same object
// it is there: unstyled, then dressed in the same tokens as every other surface.
//
// the design system mounts one per layout. This mounts one, at the root, because both the app
// shell and the login page raise errors and there is no reason for two.
import { Toaster as Sonner } from "sonner";

export function Notifications() {
  return (
    <Sonner
      position="top-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-3 w-full rounded-xl border border-borderDark bg-backgroundLight p-4 shadow-sm text-text",
          title: "text-sm font-medium",
          description: "text-xs text-textLight",
          icon: "shrink-0",
          actionButton:
            "rounded-md bg-text text-background px-2 py-1 text-xs font-medium",
          cancelButton:
            "rounded-md border border-borderDark px-2 py-1 text-xs text-textLight",
          success: "[&_[data-icon]]:text-green-500",
          error: "[&_[data-icon]]:text-red-500",
          warning: "[&_[data-icon]]:text-amber-500",
          info: "[&_[data-icon]]:text-accent",
        },
      }}
    />
  );
}
