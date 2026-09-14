// Origin: the in-house design system, src/components/ui/Input.tsx. Copied to keep this app native to the design system.
//
// Only change: @/components/ -> @/components/kit/; next-translate/useTranslation -> @/helpers/i18n/useTranslation.
import { Button } from "@/components/kit/ui/Button";
import { Label } from "@/components/kit/ui/Label";
import { Loader } from "@/components/kit/feedback/Loader";
import { cn } from "@/helpers/common/cn";
import { capitalizeFirstLetter } from "@/helpers/formatting/capitalizeFirstLetter";
import useTranslation from "@/helpers/i18n/useTranslation";
import {
  ChangeEvent,
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
} from "react";
import { InputProps, TextareaProps } from "@/types/entities";

const CONTROL_BASE =
  " bg-backgroundLight/60 hover:bg-backgroundLight/70 text-text placeholder-textLight/50 border border-borderDark disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none transition duration-200 scrollbar-app [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const INPUT_SIZE = "min-h-10 px-3 py-2 rounded-lg text-sm";
const INPUT_SIZES: Record<string, string> = {
  small: "min-h-8 px-2 py-1 rounded-lg text-sm",
  normal: INPUT_SIZE,
  large: INPUT_SIZE,
};

function getPlaceholderText(
  placeholder: string | undefined,
  label: string | undefined,
  fallbackPrefix: string,
  fallbackValue: string,
): string {
  const fallback = label
    ? `${fallbackPrefix} ${label.toLowerCase()}`
    : fallbackValue;
  return String(capitalizeFirstLetter(placeholder || fallback));
}

function getStringValue(value: InputProps["value"]) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      disabled,
      value = "",
      placeholder,
      maxLength,
      onChange,
      onKeyDown,
      onBlur,
      rows = 2,
      autoFocus,
      id,
      name,
      required,
    },
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(
      ref,
      () => textareaRef.current as HTMLTextAreaElement,
      [],
    );

    useEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }, [value]);

    return (
      <textarea
        ref={textareaRef}
        id={id}
        name={name}
        required={required}
        className={className}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        rows={rows}
        autoFocus={autoFocus}
        style={{ overflow: "hidden" }}
      />
    );
  },
);

Textarea.displayName = "Textarea";

interface InputControlProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> {
  value?: InputProps["value"];
  prependPrefix?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  buttons?: ReactNode;
  icon?: ReactNode;
  block?: boolean;
}

const InputControl = forwardRef<HTMLInputElement, InputControlProps>(
  (
    {
      type = "text",
      disabled = false,
      value = "",
      prependPrefix = "",
      id,
      className,
      maxLength,
      placeholder,
      onChange,
      onKeyDown,
      min,
      max,
      step,
      buttons,
      icon,
      block: _block,
      name,
      ...rest
    },
    ref,
  ) => {
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center">
          {prependPrefix && (
            <div className="rounded-l-lg border min-h-11 border-borderLight border-r-none bg-backgroundLight flex items-center px-3">
              {prependPrefix}
            </div>
          )}
          <div className="relative flex-1">
            {Boolean(icon) && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-textLight pointer-events-none [&_svg]:h-[15px] [&_svg]:w-[15px] [&_svg]:shrink-0 [&_svg_*]:[stroke-width:1.9]">
                {icon as ReactNode}
              </span>
            )}
            <input
              ref={ref}
              className={className}
              disabled={disabled}
              type={type}
              value={getStringValue(value)}
              placeholder={placeholder}
              maxLength={maxLength}
              min={min}
              max={max}
              step={step}
              onKeyDown={onKeyDown}
              onChange={onChange}
              id={id}
              name={name}
              {...(rest as Record<string, unknown>)}
            />
          </div>
        </div>
        {buttons ? (buttons as ReactNode) : null}
      </div>
    );
  },
);

InputControl.displayName = "InputControl";

export const Input = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  InputProps
>(
  (
    {
      type = "text",
      disabled = false,
      value = "",
      prependPrefix = "",
      required,
      label,
      id: idProp,
      className,
      maxLength,
      placeholder,
      block,
      size = "normal",
      onChange,
      onKeyDown,
      onBlur,
      rows,
      autoFocus,
      min,
      max,
      step,
      buttons,
      labelButton,
      icon,
      name,
      options,
      optionsLoading,
      onOptionSelect,
      ...rest
    }: InputProps,
    ref,
  ) => {
    const reactId = useId();
    const id =
      typeof idProp === "string" && idProp.length > 0 ? idProp : reactId;
    const { t } = useTranslation("common");
    const controlClassName = cn(
      CONTROL_BASE,
      INPUT_SIZES[size] || INPUT_SIZES.normal,
      block && "w-full",
      prependPrefix && "rounded-l-none -ml-[1px]",
      icon && "pl-7",
      className,
    );

    const placeholderText = getPlaceholderText(
      placeholder,
      label,
      t("Enter"),
      t("Enter value"),
    );
    return (
      <div className="w-full">
        {labelButton ? (
          <div className={cn("flex items-center justify-between gap-2 mb-2")}>
            <span
              className={cn(
                "text-textLight",
                size === "small" ? "text-xs" : "text-sm",
              )}
            >
              {label}
            </span>
            {labelButton}
          </div>
        ) : (
          <Label
            id={id}
            label={label}
            size={size === "small" ? "small" : "normal"}
            required={required}
          />
        )}
        {type === "textarea" ? (
          <div className="relative">
            <Textarea
              ref={ref as Ref<HTMLTextAreaElement>}
              id={id}
              name={name}
              required={required}
              className={controlClassName}
              disabled={disabled}
              value={typeof value === "string" ? value : ""}
              placeholder={placeholderText}
              maxLength={maxLength}
              onChange={onChange}
              onKeyDown={onKeyDown}
              onBlur={onBlur}
              rows={rows}
              autoFocus={autoFocus}
            />
            {buttons && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-end gap-2">
                {buttons}
              </div>
            )}
          </div>
        ) : (
          <InputControl
            ref={ref as Ref<HTMLInputElement>}
            type={type}
            disabled={disabled}
            value={value}
            prependPrefix={prependPrefix}
            id={id}
            className={controlClassName}
            maxLength={maxLength}
            placeholder={placeholderText}
            block={block}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            min={min}
            max={max}
            step={step}
            buttons={buttons}
            icon={icon}
            name={name}
            {...rest}
          />
        )}
        {optionsLoading ? (
          <div className="mt-2">
            <Loader count={4} cols={1} height={48} gap={2} />
          </div>
        ) : options && options.length > 0 ? (
          <div className="mt-2 space-y-2">
            {options.map((option) => {
              const isActive = typeof value === "string" && value === option;
              return (
                <Button
                  key={option}
                  variant="solid"
                  size="large"
                  block
                  justifyContent="start"
                  disabled={isActive}
                  className="whitespace-normal text-left"
                  onClick={() => onOptionSelect?.(option)}
                >
                  {option}
                </Button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
