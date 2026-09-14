// Origin: the in-house design system, src/components/feedback/Spinner.tsx. Copied to keep this app native to the design system.
//
// Only change: @/components/ -> @/components/kit/.
import { cn } from "@/helpers/common/cn";
import { Icon } from "@/components/kit/ui/Icon";
import { Loading03Icon } from "@hugeicons/core-free-icons";

export function Spinner({
  size = 15,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Icon
      icon={Loading03Icon}
      size={size}
      className={cn("rotating-element shrink-0 text-textLight", className)}
    />
  );
}

export function SpinnerRow() {
  return (
    <div className="flex justify-center py-2">
      <Spinner />
    </div>
  );
}
