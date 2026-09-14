// Origin: the in-house design system, src/components/ui/Avatar.tsx. Copied to keep this app native to the design system.
//
// Only change: @/components/ -> @/components/kit/.
import { Image } from "@/components/kit/ui/Image";
import { memo } from "react";

const getInitials = (label?: string): string => {
  if (!label) return "U";
  const parts = label.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const Avatar = memo(
  ({
    src,
    label,
    size = 20,
  }: {
    src?: string;
    label?: string;
    size?: number;
  }) =>
    src ? (
      <div
        className="relative rounded-full overflow-hidden shrink-0"
        style={{ width: size, height: size }}
      >
        <Image
          file={{ src, alt: label || "User" }}
          fill
          className="object-cover"
        />
      </div>
    ) : (
      <span
        className="rounded-full bg-backgroundLight text-textLight flex items-center justify-center text-[10px] font-medium shrink-0"
        style={{ width: size, height: size }}
      >
        {getInitials(label)}
      </span>
    ),
);
Avatar.displayName = "Avatar";
