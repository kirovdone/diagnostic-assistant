// Origin: the in-house design system, src/consts/input.ts. Copied unchanged.
import { FIELD_LIMITS } from "@/consts/fieldLimits";

export const MAX_LENGTH_INPUT = {
  name: FIELD_LIMITS.pageName,
  description: FIELD_LIMITS.metaDescription,
  message: FIELD_LIMITS.chatMessage,
  title: FIELD_LIMITS.metaTitle,
} as const;
