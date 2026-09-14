// Origin: the in-house design system, src/chat/ui/ThinkingDots.tsx. Copied to keep this app native to the design system.
//
// Only change: @/helpers/i18n/useTranslation for next-translate.

import { cn } from "@/helpers/common/cn";
import useTranslation from "@/helpers/i18n/useTranslation";

const DELAYS = ["0ms", "160ms", "320ms"];

export function ThinkingDots({ className }: { className?: string }) {
  const { t } = useTranslation("common");
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-1 py-1", className)}
    >
      {DELAYS.map((delay) => (
        <span
          key={delay}
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-text/40 animate-thinking"
          style={{ animationDelay: delay }}
        />
      ))}
      <span className="sr-only">{t("Thinking...")}</span>
    </div>
  );
}
