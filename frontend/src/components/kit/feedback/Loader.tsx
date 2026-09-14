// Origin: the in-house design system, src/components/feedback/Loader.tsx. Copied to keep this app native to the design system.
// Copied with no changes.
import { cn } from "@/helpers/common/cn";
import React, { memo } from "react";
import { LoaderProps } from "@/types/entities";

const toCssSize = (value: string | number | undefined) =>
  typeof value === "number" ? `${value}px` : value;

const WebsiteSkeleton = ({ className }: { className?: string }) => (
  <div className={cn("flex h-full w-full flex-col bg-background", className)}>
    <div className="flex shrink-0 items-center justify-between p-5">
      <div className="h-4 w-1/4 animate-pulse rounded bg-skeleton" />
      <div className="flex w-2/5 gap-2">
        <div className="h-4 w-1/3 animate-pulse rounded bg-skeleton" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-skeleton" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-skeleton" />
      </div>
    </div>
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-5">
      <div className="h-4 w-3/4 animate-pulse rounded bg-skeleton" />
      <div className="h-4 w-3/5 animate-pulse rounded bg-skeleton" />
      <div className="h-4 w-2/5 animate-pulse rounded bg-skeleton" />
      <div className="h-4 w-28 animate-pulse rounded bg-skeleton" />
    </div>
  </div>
);

const LogoSkeleton = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "flex h-full w-full flex-col items-center justify-center gap-3 bg-background p-5",
      className,
    )}
  >
    <div className="aspect-square w-2/5 animate-pulse rounded-2xl bg-skeleton" />
    <div className="flex w-full flex-col items-center gap-3">
      <div className="h-4 w-1/2 animate-pulse rounded bg-skeleton" />
      <div className="h-4 w-1/3 animate-pulse rounded bg-skeleton" />
    </div>
  </div>
);

const DOCUMENT_LINES = [
  "w-1/2",
  "w-full",
  "w-11/12",
  "w-3/4",
  null,
  "w-2/5",
  "w-full",
  "w-10/12",
  "w-11/12",
  "w-2/3",
];

const DocumentSkeleton = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "flex h-full w-full flex-col gap-[2.5%] bg-background p-[7%]",
      className,
    )}
  >
    {DOCUMENT_LINES.map((width, i) =>
      width ? (
        <div
          key={i}
          className={cn(
            "h-[4%] shrink-0 animate-pulse rounded bg-skeleton",
            width,
          )}
        />
      ) : (
        <div key={i} className="h-[3%] shrink-0" />
      ),
    )}
  </div>
);

const AdSkeleton = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "flex h-full w-full flex-col justify-end gap-3 bg-background p-5",
      className,
    )}
  >
    <div className="h-4 w-3/4 animate-pulse rounded bg-skeleton" />
    <div className="h-4 w-1/2 animate-pulse rounded bg-skeleton" />
    <div className="h-4 w-1/3 animate-pulse rounded bg-skeleton" />
  </div>
);

const SKELETONS = {
  website: WebsiteSkeleton,
  logo: LogoSkeleton,
  document: DocumentSkeleton,
  ad: AdSkeleton,
};

export const Loader = memo(function Loader({
  width,
  height = 32,
  cols = 4,
  count = 5,
  gap = 3,
  className,
  color,
  type,
  label,
  detail,
}: LoaderProps) {
  const Skeleton = type ? SKELETONS[type] : undefined;
  if (Skeleton) {
    if (!label && !detail) return <Skeleton className={className} />;
    return (
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        className={cn("relative h-full w-full", className)}
      >
        <Skeleton />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
          {label && <p className="font-medium text-text">{label}</p>}
          {detail && <p className="text-sm text-textLight">{detail}</p>}
        </div>
      </div>
    );
  }

  const resolvedWidth = toCssSize(width);
  const resolvedHeight = height === "auto" ? undefined : toCssSize(height);
  const itemStyle: React.CSSProperties = {};
  if (resolvedWidth) itemStyle.width = resolvedWidth;
  if (resolvedHeight) itemStyle.height = resolvedHeight;
  if (color) itemStyle.backgroundColor = color;

  const responsive = typeof cols === "string";

  return (
    <div
      className={cn("grid", responsive ? cols : undefined)}
      style={
        responsive
          ? undefined
          : {
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gap: `${gap * 0.25}rem`,
            }
      }
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          data-slot="skeleton"
          className={cn("animate-pulse rounded-lg bg-skeleton", className)}
          style={itemStyle}
        />
      ))}
    </div>
  );
});
