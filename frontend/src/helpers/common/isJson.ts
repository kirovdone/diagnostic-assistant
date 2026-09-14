// Origin: the in-house design system, src/helpers/common/isJson.ts. Copied to keep this app native to the design system.
// Copied with no changes.
import { jsonrepair } from "jsonrepair";

export const safeParseJson = <T = unknown>(str?: string | null): T | null => {
  if (!str) return null;
  try {
    return JSON.parse(str) as T;
  } catch {
    try {
      return JSON.parse(jsonrepair(str)) as T;
    } catch {
      return null;
    }
  }
};
