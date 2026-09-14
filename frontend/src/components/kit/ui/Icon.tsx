// Origin: the in-house design system, src/components/ui/Icon.tsx. Copied to keep this app native to the design system.
// Copied with no changes.
import { HugeiconsIcon } from "@hugeicons/react";
import type { ComponentProps } from "react";

export type { IconSvgElement } from "@hugeicons/react";

export const Icon = (props: ComponentProps<typeof HugeiconsIcon>) => (
  <HugeiconsIcon size={15} {...props} />
);
