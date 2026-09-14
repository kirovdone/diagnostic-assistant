"use client";

// Origin: the in-house design system, src/components/ui/Sheet.tsx.
//
// Reduced by one dependency: the original picks a side with `cva`, which is not installed
// here and would be a package for four class strings. Only the right side is used, so the
// variant table is gone and its classes are inline. Everything else — the overlay, the
// enter and exit animations, the header with its close control, the focus ring — is
// unchanged.

import { Icon } from "@/components/kit/ui/Icon";
import { FOCUS_RING } from "@/consts/styles";
import { cn } from "@/helpers/common/cn";
import useTranslation from "@/helpers/i18n/useTranslation";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import {
  forwardRef,
  type ComponentProps,
  type ComponentRef,
  type HTMLAttributes,
} from "react";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = forwardRef<
  ComponentRef<typeof SheetPrimitive.Overlay>,
  ComponentProps<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-xs",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

export const SheetContent = forwardRef<
  ComponentRef<typeof SheetPrimitive.Content>,
  ComponentProps<typeof SheetPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 right-0 z-50 h-full w-[80vw] border-l border-l-borderDark bg-background text-text shadow-sm transition ease-in-out lg:max-w-lg",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
        "data-[state=open]:duration-500 data-[state=closed]:duration-200",
        className,
      )}
      {...props}
    >
      {children}
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = "SheetContent";

export const SheetHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col text-center", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

export const SheetTitle = forwardRef<
  ComponentRef<typeof SheetPrimitive.Title>,
  ComponentProps<typeof SheetPrimitive.Title>
>(({ className, children, ...props }, ref) => {
  const { t } = useTranslation("common");
  return (
    <SheetPrimitive.Title
      ref={ref}
      className={cn(
        "flex items-center justify-between border-b border-b-borderDark pb-3 text-2xl",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      <SheetPrimitive.Close
        aria-label={t("Close")}
        className={cn(
          "inline-flex h-9 max-h-8 max-w-8 min-w-8 items-center justify-center rounded-lg p-2 text-text outline-none transition duration-200 hover:bg-backgroundLight",
          FOCUS_RING,
        )}
      >
        <Icon icon={Cancel01Icon} />
      </SheetPrimitive.Close>
    </SheetPrimitive.Title>
  );
});
SheetTitle.displayName = "SheetTitle";

export const SheetDescription = SheetPrimitive.Description;
