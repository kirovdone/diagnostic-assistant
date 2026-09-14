// Origin: the in-house design system, src/components/feedback/NotFound.tsx. Copied to keep this app native to the design system.
//
// Only change: next-translate/useTranslation -> @/helpers/i18n/useTranslation.
import { cn } from "@/helpers/common/cn";
import { NotFoundProps } from "@/types/entities";
import useTranslation from "@/helpers/i18n/useTranslation";
import { memo } from "react";
import { BsImageAlt } from "react-icons/bs";

export const NotFound = memo(function NotFound({
  type = "text",
  className,
  icon,
  title,
  subtitle,
}: NotFoundProps) {
  const { t } = useTranslation("common");

  if (type === "image") {
    if (title || subtitle) {
      return (
        <div
          className={cn(
            "relative flex w-full flex-col items-center justify-center rounded-xl p-4 border border-borderDark space-y-3 bg-backgroundLight/50",
            className,
          )}
        >
          {icon}
          <div className="space-y-2 text-center">
            {title && (
              <h3 className="text-md font-medium text-text">{title}</h3>
            )}
            {subtitle && (
              <p className="text-sm text-textLight max-w-md">{subtitle}</p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "relative flex h-full min-h-[30px] w-full min-w-[30px] items-center justify-center bg-backgroundDark",
          className,
        )}
      >
        <BsImageAlt
          size="50%"
          className="fill-backgroundLight stroke-transparent p-4"
        />
      </div>
    );
  }

  if (type === "icon") {
    return (
      <div
        className={cn(
          "relative flex h-[40px] w-[40px] min-h-[40px] min-w-[40px] items-center justify-center rounded-md bg-backgroundDark",
          className,
        )}
      >
        <BsImageAlt
          size="100%"
          className="fill-backgroundLight stroke-transparent p-1.5"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-md text-sm p-2 text-center text-textLight/50",
        className,
      )}
      role="status"
      aria-label={t("No results found")}
    >
      {t("No results found")}
    </div>
  );
});
