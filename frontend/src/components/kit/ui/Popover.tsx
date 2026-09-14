// Origin: the in-house design system, src/components/ui/Popover.tsx. Copied to keep this app native to the design system.
//
// Only change: @/components/ -> @/components/kit/; next-translate/useTranslation -> @/helpers/i18n/useTranslation.
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { FOCUS_RING } from "@/consts/styles";
import { cn } from "@/helpers/common/cn";
import {
  PortalContainerProvider,
  usePortalContainer,
} from "@/components/kit/ui/portalContainer";
import {
  forwardRef,
  type ComponentProps,
  type ComponentRef,
  type ButtonHTMLAttributes,
} from "react";

export { PortalContainerProvider as PopoverContainerProvider };

export const Popover = PopoverPrimitive.Root;

export const PopoverTrigger = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, type = "button", ...props }, ref) => (
  <PopoverPrimitive.Trigger asChild>
    <button
      ref={ref}
      type={type}
      className={cn(
        "flex items-center justify-center rounded-lg px-2 py-1 text-text transition-colors",
        "min-h-8 min-w-8 cursor-pointer",
        FOCUS_RING,
        "outline-none",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Trigger>
));
PopoverTrigger.displayName = "PopoverTrigger";

export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverContent = forwardRef<
  ComponentRef<typeof PopoverPrimitive.Content>,
  ComponentProps<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 8, ...props }, ref) => {
  const container = usePortalContainer();
  return (
    <PopoverPrimitive.Portal container={container ?? undefined}>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionBoundary={container ?? undefined}
        collisionPadding={container ? 8 : undefined}
        data-popover-content=""
        className={cn(
          "z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl bg-backgroundDark border border-borderDark p-2 space-y-2 text-text outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
          "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = "PopoverContent";
