// Origin: the in-house design system, src/consts/styles.ts. Copied to keep this app native to the design system.
// Copied with no changes.
import type { BadgeTone } from "@/types/components";

export const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  success: "bg-green-100 text-green-900",
  destructive: "bg-red-100 text-red-900",
  warning: "bg-yellow-100 text-yellow-900",
  neutral: "bg-neutral-100 text-neutral-900",
  featured: "bg-blue-100 text-blue-900",
};

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

export const FOLD_MIN_H = "min-h-[calc(100svh-3.5rem)]";

export const PAGE_TITLE =
  "text-balance text-[clamp(30px,4vw,44px)] font-semibold leading-[1.15] tracking-[-0.022em]";

export const SECTION_TITLE =
  "text-balance text-[clamp(24px,2.8vw,34px)] font-semibold leading-[1.2] tracking-[-0.02em]";

export const SECTION_HEAD =
  "mx-auto mb-12 flex max-w-3xl flex-col items-center px-6 text-center md:mb-14";

export const SECTION_BODY =
  "mt-4 max-w-xl text-[16px] leading-relaxed text-textLight";

export const CARD_PADDING = "p-5";

export const CARD_CLASSES =
  "rounded-xl border border-borderDark bg-backgroundLight p-3";

export const ASSET_GRID =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

export const BRAND_TILE =
  "flex-col items-stretch gap-0 p-0 w-full whitespace-normal overflow-hidden rounded-lg border border-borderLight bg-backgroundDark text-left shadow-xs no-underline hover:no-underline transition-opacity duration-200 hover:opacity-80";

export const AVATAR_FALLBACK =
  "shrink-0 w-5 h-5 rounded-full bg-accent text-textDark flex items-center justify-center text-xs font-medium";

export const MODAL_SHELL =
  "h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] min-w-0 overflow-hidden p-0 sm:h-[80vh] sm:max-h-176 sm:w-full sm:max-w-2xl lg:min-w-0 lg:max-w-4xl";

export const MODAL_RAIL =
  "w-full shrink-0 border-b border-borderDark bg-backgroundLight/50 p-3 sm:flex sm:h-full sm:w-48 sm:flex-col sm:overflow-hidden sm:border-b-0 sm:border-r";

export const MODAL_TABS =
  "flex gap-2 overflow-x-auto scrollbar-app sm:min-h-0 sm:flex-1 sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto";
