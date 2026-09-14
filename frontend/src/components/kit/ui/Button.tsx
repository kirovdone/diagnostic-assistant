"use client";

// Origin: the in-house design system, src/components/ui/Button.tsx. Copied to keep this app native to the design system.
//
// Only change: @/components/ -> @/components/kit/; next-translate/useTranslation -> @/helpers/i18n/useTranslation.

import { Loader } from "@/components/kit/feedback/Loader";
import { FOCUS_RING } from "@/consts/styles";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/kit/ui/Accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/kit/ui/DropdownMenu";
import { Icon } from "@/components/kit/ui/Icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/kit/ui/Popover";
import { cn } from "@/helpers/common/cn";
import type { ButtonSize } from "@/types/common";
import type { ButtonProps, ButtonVariant } from "@/types/components";
import { ArrowRight01Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import useTranslation from "@/helpers/i18n/useTranslation";
import Link from "next/link";
import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type CSSProperties,
  forwardRef,
  type MouseEvent,
  useState,
} from "react";
import { createPortal } from "react-dom";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  solid:
    "bg-backgroundDark border border-borderLight shadow-xs hover:opacity-80",
  accent: "bg-accent text-textDark! shadow-xs hover:opacity-90",
  outline: "border border-borderDark hover:bg-backgroundLight",
  transparent: "hover:bg-backgroundLight",
  none: "",
  danger: "hover:bg-destructive/20 text-destructive",
};

const ICON_SIZE = 15;

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xsmall: "p-[3px] min-w-5 min-h-5 shrink-0 rounded-md text-xs",
  small: "px-2 py-1 min-w-8 min-h-8 rounded-lg",
  normal: "px-3 py-2 min-w-10 min-h-10 rounded-lg",
  large: "p-3 min-w-10 min-h-12 rounded-lg",
};

const ICON_ONLY_CLASSES: Record<ButtonSize, string> = {
  xsmall: "size-5 p-0 justify-center",
  small: "size-8 p-0 justify-center",
  normal: "size-10 p-0 justify-center",
  large: "size-12 p-0 justify-center",
};

const JUSTIFY_CLASSES: Record<
  NonNullable<ButtonProps["justifyContent"]>,
  string
> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
};

const BASE_CLASSES =
  FOCUS_RING +
  " flex items-center gap-1 font-medium hover:cursor-pointer whitespace-nowrap text-sm outline-none transition-colors duration-200 overflow-hidden text-ellipsis text-text [&_svg]:!w-[var(--icon-size)] [&_svg]:!h-[var(--icon-size)] [&_svg]:!shrink-0 [&_svg_*]:[stroke-width:1.9]";

const SUB_TRIGGER_CLASSES =
  "w-full cursor-pointer rounded-lg px-2 py-1.5 text-sm font-medium text-text hover:bg-backgroundLight [&_svg]:w-4.5! [&_svg]:h-4.5! [&_svg]:shrink-0! [&_svg_*]:stroke-[1.9]";

const HAS_SCHEME = /^(?:https?:|mailto:|tel:)/i;

const MAILTO_OR_TEL = /^(?:mailto:|tel:)/i;

const getHref = (link: string, linkType: string): string => {
  switch (linkType) {
    case "external":
      return HAS_SCHEME.test(link) ? link : `https://${link}`;
    case "email":
      return `mailto:${link}`;
    case "phone":
      return `tel:${link}`;
    default:
      return link;
  }
};

export const buttonClassName = ({
  size = "normal",
  variant = "transparent",
  justifyContent = "start",
  className,
}: {
  size?: ButtonSize;
  variant?: ButtonVariant;
  justifyContent?: NonNullable<ButtonProps["justifyContent"]>;
  className?: string;
} = {}) =>
  cn(
    BASE_CLASSES,
    SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    JUSTIFY_CLASSES[justifyContent],
    className,
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      id,
      className,
      variant,
      size = "normal",
      link,
      linkType = "page",
      prefetch = false,
      loading = false,
      block = false,
      icon,
      color,
      items,
      itemsType = "dropdown",
      content,
      tooltipLabel,
      disabled = false,
      rel,
      open,
      onOpenChange,
      onContentInteractOutside,
      onContentScroll,
      contentHeader,
      contentFooter,
      itemsLoading,
      label,
      children,
      style,
      justifyContent = "start",
      justifyItems = "start",
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation("common");
    const { name, type, onClick, ...domProps } = props;

    const inert = loading || disabled;
    const isIconOnly = !label && !children && (Boolean(icon) || loading);
    const [tip, setTip] = useState<{ left: number; top: number } | null>(null);

    const sharedProps = {
      id,
      className: cn(
        buttonClassName({
          size,
          variant: variant ?? "transparent",
          justifyContent,
        }),
        inert && "opacity-50 pointer-events-none",
        block && "w-full",
        isIconOnly && ICON_ONLY_CLASSES[size],
        className,
      ),
      style: {
        ...style,
        ...(color ? { color } : {}),
        ["--icon-size" as string]: `${ICON_SIZE}px`,
      } as CSSProperties,
      ...(name || tooltipLabel
        ? { "aria-label": name ?? tooltipLabel }
        : {}),
      ...(tooltipLabel
        ? {
            onMouseEnter: (e: MouseEvent<HTMLElement>) => {
              const r = e.currentTarget.getBoundingClientRect();
              setTip({ left: r.left + r.width / 2, top: r.top - 6 });
            },
            onMouseLeave: () => setTip(null),
            onMouseDown: () => setTip(null),
          }
        : {}),
    };

    const tooltip =
      tooltipLabel && tip
        ? createPortal(
            <span
              className="pointer-events-none fixed z-9999 -translate-x-1/2 -translate-y-full rounded-md border border-borderDark bg-backgroundDark px-2 py-1 text-xs whitespace-nowrap text-text shadow-xs"
              style={{ left: tip.left, top: tip.top }}
            >
              {tooltipLabel}
            </span>,
            document.body,
          )
        : null;

    const buttonContent = (
      <>
        {loading ? (
          <Icon icon={Loading03Icon} className="rotating-element" />
        ) : (
          icon
        )}
        {label ? <span className="truncate">{label}</span> : children}
      </>
    );

    const renderLink = (to: string) => (
      <Link
        href={getHref(to, linkType)}
        {...(domProps as AnchorHTMLAttributes<HTMLAnchorElement>)}
        target={
          linkType === "external" && !MAILTO_OR_TEL.test(to)
            ? "_blank"
            : undefined
        }
        prefetch={prefetch}
        aria-disabled={inert || undefined}
        tabIndex={inert ? -1 : undefined}
        onClick={(e: MouseEvent<HTMLAnchorElement>) => {
          if (inert) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
        rel={rel}
        {...sharedProps}
      >
        {buttonContent}
      </Link>
    );

    const renderPopover = () => (
      <Popover open={inert ? false : open} onOpenChange={onOpenChange}>
        <PopoverTrigger {...sharedProps}>{buttonContent}</PopoverTrigger>
        <PopoverContent
          align={justifyItems}
          className="p-2 max-h-80 flex flex-col overflow-hidden"
          onInteractOutside={onContentInteractOutside}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {contentHeader && (
            <div className="shrink-0 pb-2">{contentHeader}</div>
          )}
          <div
            onScroll={onContentScroll}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-app"
          >
            {content}
          </div>
          {contentFooter && (
            <div className="shrink-0 pt-2">{contentFooter}</div>
          )}
        </PopoverContent>
      </Popover>
    );

    const renderAccordion = () => (
      <Accordion
        type="single"
        defaultValue={open ? "accordion-item" : undefined}
        collapsible
      >
        <AccordionItem value="accordion-item">
          <AccordionTrigger {...sharedProps}>{buttonContent}</AccordionTrigger>
          <AccordionContent className="space-y-2 pt-3">
            {items && items.length > 0 ? (
              items.map((item, i) => (
                <Button
                  key={i}
                  {...item}
                  className={cn("overflow-hidden", item.className)}
                  block
                />
              ))
            ) : itemsLoading ? (
              <Loader cols={1} count={3} gap={2} />
            ) : null}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    const renderDropdownItem = (item: ButtonProps, i: number) => {
      if (item.items?.length) {
        return (
          <DropdownMenuSub key={`item-${i}-sub`}>
            <DropdownMenuSubTrigger className={SUB_TRIGGER_CLASSES}>
              <span className="flex flex-1 items-center gap-1 truncate text-left">
                {item.icon}
                {item.label}
              </span>
              <Icon
                icon={ArrowRight01Icon}
                className="ml-2 shrink-0 text-textLight"
              />
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent
                sideOffset={16}
                alignOffset={-16}
                className="space-y-1"
              >
                {item.items.map((subItem, j) => (
                  <Button
                    key={`item-${i}-sub-${j}`}
                    {...subItem}
                    size={subItem.size ?? "small"}
                    block
                  />
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        );
      }
      const { actions, ...rest } = item;
      if (!actions?.length) {
        return (
          <Button
            key={`item-${i}`}
            {...rest}
            size={rest.size ?? "small"}
            block
          />
        );
      }

      return (
        <div key={`item-${i}`} className="flex items-center gap-1">
          <Button
            {...rest}
            size={rest.size ?? "small"}
            block
            className={cn("min-w-0 flex-1", rest.className)}
          />
          {actions.map((action, j) =>
            action.onClick || action.link ? (
              <Button
                key={`item-${i}-action-${j}`}
                {...action}
                size={action.size ?? "small"}
                justifyContent="center"
              />
            ) : (
              <span
                key={`item-${i}-action-${j}`}
                className="shrink-0 text-textLight [&_svg]:h-4 [&_svg]:w-4"
              >
                {action.icon}
              </span>
            ),
          )}
        </div>
      );
    };

    const renderDropdown = () => (
      <DropdownMenu modal={false} open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger disabled={inert} {...sharedProps}>
          {buttonContent}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={justifyItems}>
          {contentHeader}
          <div
            onScroll={onContentScroll}
            className="overflow-y-auto scrollbar-app space-y-1 max-h-48"
          >
            {itemsLoading ? (
              <Loader cols={1} count={3} gap={2} />
            ) : items?.length ? (
              items.map(renderDropdownItem)
            ) : (
              <div
                className="relative rounded-md text-sm p-2 text-center text-textLight/50"
                role="status"
              >
                {t("No results found")}
              </div>
            )}
          </div>
          {contentFooter}
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const element = link ? (
      renderLink(link)
    ) : content && !items ? (
      renderPopover()
    ) : items && itemsType === "accordion" ? (
      renderAccordion()
    ) : items || contentHeader || contentFooter ? (
      renderDropdown()
    ) : (
      <button
        ref={ref}
        {...(domProps as ButtonHTMLAttributes<HTMLButtonElement>)}
        type={type ?? "button"}
        onClick={onClick}
        disabled={inert}
        {...sharedProps}
      >
        {buttonContent}
      </button>
    );

    return (
      <>
        {element}
        {tooltip}
      </>
    );
  },
);

Button.displayName = "Button";

export type { ButtonProps, ButtonVariant };
