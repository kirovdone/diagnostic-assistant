// Origin: the in-house design system, src/helpers/common/cn.ts. Copied to keep this app native to the design system.
// Copied with no changes.
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
