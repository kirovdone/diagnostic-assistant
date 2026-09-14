// Origin: the in-house design system, src/components/ui/Callout.tsx. Copied to keep this app native to the design system.
//
// Only change: @/components/ -> @/components/kit/.
import { Button } from "@/components/kit/ui/Button";
import { cn } from "@/helpers/common/cn";
import { Icon } from "@/components/kit/ui/Icon";
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  CancelCircleIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import type { BadgeTone } from "@/types/entities";
import { CalloutProps } from "@/types/entities";

const TONE_ICONS: Record<BadgeTone, typeof Alert02Icon> = {
  success: CheckmarkCircle02Icon,
  destructive: CancelCircleIcon,
  warning: Alert02Icon,
  neutral: InformationCircleIcon,
  featured: InformationCircleIcon,
};

const TONE_ICON_CLASSES: Record<BadgeTone, string> = {
  success: "text-green-500",
  destructive: "text-red-500",
  warning: "text-amber-500",
  neutral: "text-textLight",
  featured: "text-blue-500",
};

const CALLOUT_TONE_CLASSES: Record<BadgeTone, string> = {
  success: "bg-green-500/10 border-green-500/30 text-text",
  destructive: "bg-red-500/10 border-red-500/30 text-text",
  warning: "bg-amber-500/10 border-amber-500/30 text-text",
  neutral: "bg-backgroundDark border-borderDark text-text",
  featured: "bg-blue-500/10 border-blue-500/30 text-text",
};

export function Callout({
  variant = "neutral",
  message,
  actions,
  className,
  ...props
}: CalloutProps) {
  const toneIcon = TONE_ICONS[variant];
  const iconClass = TONE_ICON_CLASSES[variant];
  const bgClass = CALLOUT_TONE_CLASSES[variant];

  return (
    <div
      className={cn(
        "w-full rounded-lg border px-3 py-2 flex items-center gap-2",
        bgClass,
        className,
      )}
      role="status"
      aria-live="polite"
      {...props}
    >
      <Icon
        icon={toneIcon}
        className={cn("size-4 shrink-0", iconClass)}
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0 truncate text-sm">{message}</span>
      {actions?.length ? (
        <div className="flex items-center gap-2 shrink-0">
          {actions.map((action, i) => (
            <Button
              key={i}
              variant="none"
              size="small"
              link={action.link}
              loading={action.loading}
              label={action.label}
              onClick={action.onClick}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
