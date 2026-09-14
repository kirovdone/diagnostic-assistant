// Origin: the in-house design system, src/components/ui/Badge.tsx. Copied to keep this app native to the design system.
// Copied with no changes.
import { cn } from "@/helpers/common/cn";
import { memo } from "react";
import { BadgeProps } from "@/types/entities";
import { BADGE_TONE_CLASSES } from "@/consts/styles";

export const Badge = memo(function Badge({
  className,
  variant = "neutral",
  label,
  children,
  ...props
}: BadgeProps) {
  const bgClass = BADGE_TONE_CLASSES[variant];
  const content = children ?? label ?? variant;
  return (
    <div
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md font-medium text-xs whitespace-nowrap",
        bgClass,
        className,
      )}
      {...props}
    >
      {content}
    </div>
  );
});
