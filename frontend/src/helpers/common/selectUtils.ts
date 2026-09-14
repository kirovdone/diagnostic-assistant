"use client";

// Origin: the in-house design system, src/helpers/common/selectUtils.ts. Copied to keep this app native to the design system.
// Copied with no changes.
import { type ReactNode } from "react";

export interface SelectOption {
  value: string;
  label?: string;
  icon?: ReactNode;
  isFixed?: boolean;
}

export function stringifyOptionValue(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "object") {
    try {
      return JSON.stringify(raw);
    } catch {
      return String(raw);
    }
  }
  return String(raw);
}

export const TRIGGER_BASE =
  "bg-backgroundLight/60 rounded-lg text-sm font-medium text-text border border-borderDark hover:bg-backgroundLight/70 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 flex items-center justify-between gap-1 text-left [&[data-placeholder]]:text-textLight/50 placeholder:text-textLight/50 outline-none [&_svg]:h-[15px] [&_svg]:w-[15px] [&_svg]:shrink-0 [&_svg_*]:[stroke-width:1.9]";

export const TRIGGER_SIZE = "min-h-10 px-3 py-2";

const TRIGGER_SIZE_SMALL = "min-h-8 px-2 py-1";

export const triggerSize = (size?: "small" | "normal"): string =>
  size === "small" ? TRIGGER_SIZE_SMALL : TRIGGER_SIZE;

export const DROPDOWN_CONTENT =
  "z-9999 min-w-(--radix-select-trigger-width) rounded-xl border border-borderDark bg-backgroundDark text-text shadow-xs";

export const DROPDOWN_ITEM =
  "relative flex items-center gap-1 px-2 min-h-8 rounded-lg text-sm font-medium cursor-pointer select-none outline-none hover:bg-backgroundLight/50 data-highlighted:bg-backgroundLight/50 data-[state=checked]:opacity-40 data-[state=checked]:pointer-events-none transition-colors duration-200 [&_svg]:h-[15px] [&_svg]:w-[15px] [&_svg]:shrink-0 [&_svg_*]:[stroke-width:1.9]";

export function resolveItem(
  item: unknown,
  labelKey: string | undefined,
  valueKey: string | undefined,
  translate: boolean,
  t: (k: string) => string,
): SelectOption {
  if (typeof item === "string" || typeof item === "number") {
    const value = String(item);
    return {
      value,
      label: translate && typeof item === "string" ? t(item) : value,
    };
  }
  const obj = item as Record<string, unknown>;
  const rawValue = valueKey ? obj[valueKey] : (obj["value"] ?? obj["_id"]);
  const rawLabel = labelKey
    ? obj[labelKey]
    : (obj["label"] ?? obj["name"] ?? rawValue);
  const label = translate ? t(String(rawLabel ?? "")) : String(rawLabel ?? "");
  const icon = obj["icon"] as ReactNode | undefined;
  const isFixed = obj["isFixed"] as boolean | undefined;
  return { value: stringifyOptionValue(rawValue), label, icon, isFixed };
}

export function resolvePlaceholder(
  label: string | undefined,
  t: (k: string) => string = (k) => k,
): string {
  return label ? `${t("Select")} ${label.toLowerCase()}` : t("Select");
}
