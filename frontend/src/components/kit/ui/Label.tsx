// Origin: the in-house design system, src/components/ui/Label.tsx. Copied to keep this app native to the design system.
//
// Only change: @/components/ -> @/components/kit/.
import { Button } from "@/components/kit/ui/Button";
import { cn } from "@/helpers/common/cn";
import { LabelProps } from "@/types/entities";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/kit/ui/Icon";

export function Label({
  id,
  label,
  size = "normal",
  icon,
  required,
  className,
  actions,
  meta,
}: LabelProps) {
  if (!label && !actions?.length && !meta) return null;

  const defaultIcon = <Icon icon={ArrowUpRight01Icon} />;

  return (
    <div
      className={cn(
        "text-textLight flex justify-between items-center gap-1",
        "mb-2",
        size === "small" ? "text-xs" : "text-sm",
        className,
      )}
    >
      {label ? (
        <label
          htmlFor={id}
          className="flex min-w-0 flex-1 items-center gap-1.5"
        >
          {icon ? (
            <span className="text-textLight shrink-0 [&_svg]:w-4 [&_svg]:h-4">
              {icon}
            </span>
          ) : null}
          <span className="truncate">{label}</span>
          {required ? <span className="shrink-0 text-red-500">*</span> : null}
        </label>
      ) : (
        <div />
      )}
      {actions?.length || meta ? (
        <div className="flex shrink-0 items-center gap-2">
          {meta ? (
            <span className="text-[11px] text-textLight">{meta}</span>
          ) : null}
          {actions?.map((action, i) => (
            <Button
              key={i}
              size="xsmall"
              variant={action.variant}
              className={cn(
                !action.variant && "text-textLight",
                action.className,
              )}
              link={action.link}
              loading={action.loading}
              icon={action.icon || defaultIcon}
              disabled={
                action.loading || (action.link !== undefined && !action.link)
              }
              onClick={action.onClick}
              items={action.items}
              justifyContent="center"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
