"use client";

// Origin: the in-house design system, src/components/ui/Breadcrumbs.tsx. Copied to keep this app native to the design system.
//
// Only change: @/components/ -> @/components/kit/; next-translate/useTranslation -> @/helpers/i18n/useTranslation.

import { Button } from "@/components/kit/ui/Button";
import { Input } from "@/components/kit/ui/Input";
import { Loader } from "@/components/kit/feedback/Loader";
import { Icon } from "@/components/kit/ui/Icon";
import { cn } from "@/helpers/common/cn";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import useTranslation from "@/helpers/i18n/useTranslation";
import {
  type ChangeEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Breadcrumb } from "@/types/components";

function BreadcrumbItem({
  label,
  icon,
  link,
  onClick,
  items,
  onOpenChange,
  onContentScroll,
  onSearchChange,
  itemsLoading,
  contentFooter,
  placeholder,
  loading,
}: Breadcrumb) {
  const { t } = useTranslation("common");
  const [query, setQuery] = useState("");
  const queryRef = useRef("");
  const onSearchChangeRef = useRef(onSearchChange);

  const hasDropdown = !!(items?.length || itemsLoading || onSearchChange);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && query) {
        setQuery("");
        onSearchChangeRef.current?.("");
      }
      onOpenChange?.(open);
    },
    [query, onOpenChange],
  );

  useEffect(() => {
    onSearchChangeRef.current = onSearchChange;
  }, [onSearchChange]);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    if (!queryRef.current) return;
    queryRef.current = "";
    setQuery("");
    onSearchChangeRef.current?.("");
  }, [label]);

  const contentHeader = onSearchChange ? (
    <div onKeyDown={(e) => e.stopPropagation()}>
      <Input
        placeholder={t("Enter query")}
        name="search"
        size="small"
        value={query}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setQuery(e.target.value);
          onSearchChange(e.target.value);
        }}
        block
      />
    </div>
  ) : undefined;

  if (loading)
    return (
      <div className="mx-2 shrink-0" aria-hidden>
        <Loader cols={1} count={1} width={96} height={16} />
      </div>
    );

  return (
    <Button
      variant="none"
      size="small"
      link={hasDropdown ? undefined : link}
      icon={icon}
      label={label}
      onClick={onClick}
      onOpenChange={handleOpenChange}
      onContentScroll={onContentScroll}
      items={hasDropdown ? (items ?? []) : undefined}
      contentHeader={contentHeader}
      contentFooter={contentFooter}
      itemsLoading={itemsLoading}
      className={cn(placeholder && "text-textLight")}
    />
  );
}

export const BreadcrumbsSkeleton = () => (
  <div className="flex items-center gap-2 min-w-0" aria-hidden>
    <Loader cols={1} count={1} width={64} height={16} />
    <Loader cols={1} count={1} width={96} height={16} />
  </div>
);

export const Breadcrumbs = memo(({ items }: { items: Breadcrumb[] }) => (
  <nav
    aria-label="breadcrumb"
    className="flex items-center min-w-0 overflow-hidden"
  >
    {items.map((item, i) => (
      <div
        key={i}
        className={cn(
          "flex items-center min-w-0",
          i === items.length - 1 && "max-w-50",
        )}
      >
        {i > 0 && (
          <Icon
            icon={ArrowRight01Icon}
            size={15}
            className="shrink-0 text-textLight"
          />
        )}
        <BreadcrumbItem {...item} />
      </div>
    ))}
  </nav>
));
Breadcrumbs.displayName = "Breadcrumbs";
