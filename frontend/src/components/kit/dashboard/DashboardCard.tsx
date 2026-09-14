"use client";

// Origin: the in-house design system, src/components/dashboard/DashboardCard.tsx. Copied to keep this app native to the design system.
//
// Only change: @/components/ -> @/components/kit/.
import { Label } from "@/components/kit/ui/Label";
import {
  BRAND_TILE,
  CARD_CLASSES as SHARED_CARD_CLASSES,
} from "@/consts/styles";
import { cn } from "@/helpers/common/cn";
import type { ReactNode } from "react";
import type { LabelProps } from "@/types/entities";

const CARD_CLASSES = cn(
  SHARED_CARD_CLASSES,
  "flex h-full flex-col overflow-hidden",
);

export { BRAND_TILE };

const BOX_BASE =
  "bg-background overflow-hidden rounded-lg border border-borderDark shadow-xs";
const HOVER = "relative hover:opacity-80 duration-200";

export const ASSET_BOX = cn(BOX_BASE, "h-100");
export const ASSET_PREVIEW = cn(ASSET_BOX, HOVER);

export const SQUARE_BOX = cn(BOX_BASE, "aspect-square");
export const SQUARE_PREVIEW = cn(SQUARE_BOX, HOVER);

export const CARD_EMPTY = "flex flex-1 items-center justify-center";

export interface CardProps {
  tour?: string;
  className?: string;
}

interface DashboardCardProps extends CardProps {
  label: string;
  icon: ReactNode;
  actions?: LabelProps["actions"];
  meta?: ReactNode;
  children: ReactNode;
}

export function DashboardCard({
  label,
  icon,
  actions,
  meta,
  tour,
  className,
  children,
}: DashboardCardProps) {
  return (
    <div className={cn(CARD_CLASSES, className)} data-tour={tour}>
      <Label
        label={label}
        icon={icon}
        actions={actions}
        meta={meta}
        className="mb-3"
      />
      {children}
    </div>
  );
}
