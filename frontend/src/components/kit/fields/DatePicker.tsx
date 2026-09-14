"use client";

// Origin: the in-house design system, src/components/fields/DatePicker.tsx. Copied to keep this app native to the design system.
//
// Only change: @/components/ -> @/components/kit/.
import * as Popover from "@radix-ui/react-popover";
import { Button } from "@/components/kit/ui/Button";
import { Input } from "@/components/kit/ui/Input";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isValid,
  isWithinInterval,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { cn } from "@/helpers/common/cn";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/kit/ui/Icon";
import { useEffect, useRef, useState } from "react";
import type { InputSize } from "@/types/entities";

interface DateInputSingleProps {
  range?: false;
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  dateFrom?: never;
  dateTo?: never;
  onRangeChange?: never;
}

interface DateInputRangeProps {
  range: true;
  value?: never;
  onChange?: never;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  onRangeChange?: (range: {
    dateFrom: Date | null;
    dateTo: Date | null;
  }) => void;
}

type DateInputProps = (DateInputSingleProps | DateInputRangeProps) & {
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  size?: InputSize;
  label?: string;
  required?: boolean;
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface CalendarHeaderProps {
  month: Date;
  onPrev: () => void;
  onNext: () => void;
}

function CalendarHeader({ month, onPrev, onNext }: CalendarHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-3">
      <Button
        size="xsmall"
        icon={<Icon icon={ArrowLeft01Icon} />}
        onClick={(e) => {
          e.preventDefault();
          onPrev();
        }}
      />
      <span className="text-sm font-medium text-text">
        {format(month, "MMMM yyyy")}
      </span>
      <Button
        size="xsmall"
        icon={<Icon icon={ArrowRight01Icon} />}
        onClick={(e) => {
          e.preventDefault();
          onNext();
        }}
      />
    </div>
  );
}

interface CalendarGridProps {
  month: Date;
  rangeFrom?: Date | null;
  rangeTo?: Date | null;
  hovered?: Date | null;
  onDayClick: (d: Date) => void;
  onDayHover?: (d: Date | null) => void;
  onMonthChange: (m: Date) => void;
}

function CalendarGrid({
  month,
  rangeFrom,
  rangeTo,
  hovered,
  onDayClick,
  onDayHover,
  onMonthChange,
}: CalendarGridProps) {
  const start = startOfWeek(startOfMonth(month));
  const end = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start, end });

  const isInRange = (d: Date) => {
    const from = rangeFrom;
    const to = rangeTo ?? hovered;
    if (!from || !to) return false;
    const [a, b] = isBefore(from, to) ? [from, to] : [to, from];
    return (
      isWithinInterval(d, { start: a, end: b }) &&
      !isSameDay(d, a) &&
      !isSameDay(d, b)
    );
  };

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <>
      <div className="grid grid-cols-7 mb-1 w-full">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-xs text-textLight font-normal w-full h-6 flex items-center justify-center"
          >
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 w-full">
          {week.map((day, di) => {
            const inMonth = isSameMonth(day, month);
            const isStart = !!rangeFrom && isSameDay(day, rangeFrom);
            const isEnd = !!rangeTo && isSameDay(day, rangeTo);
            const inRange = isInRange(day);

            return (
              <Button
                key={di}
                label={format(day, "d")}
                onClick={() => {
                  if (!inMonth) onMonthChange(startOfMonth(day));
                  onDayClick(day);
                }}
                onMouseEnter={() => onDayHover?.(day)}
                onMouseLeave={() => onDayHover?.(null)}
                size="xsmall"
                className={cn(
                  "h-8 w-full min-w-0 text-sm rounded-none! justify-center",
                  (inRange || isStart || isEnd) && "bg-backgroundLight!",
                  isStart && "rounded-l-md!",
                  isEnd && "rounded-r-md!",
                  inMonth ? "text-text" : "text-textLight/40",
                )}
              />
            );
          })}
        </div>
      ))}
    </>
  );
}

const DATE_FORMAT = "dd/MM/yyyy";

function toDisplayValue(date: Date | null | undefined): string {
  return date && isValid(date) ? format(date, DATE_FORMAT) : "";
}

function parseDisplayDate(str: string): Date | null {
  const d = parse(str.trim(), DATE_FORMAT, new Date());
  return isValid(d) ? d : null;
}

function DateInput(props: DateInputProps) {
  const {
    placeholder,
    disabled,
    className,
    id,
    name,
    size = "normal",
    label,
    required,
  } = props;

  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(
    (props.range ? props.dateFrom : props.value) ?? new Date(),
  );
  const [hovered, setHovered] = useState<Date | null>(null);
  const [pendingFrom, setPendingFrom] = useState<Date | null>(null);

  const computedDisplay = props.range
    ? [toDisplayValue(props.dateFrom), toDisplayValue(props.dateTo)]
        .filter(Boolean)
        .join(" – ")
    : toDisplayValue(props.value);

  const [inputText, setInputText] = useState(computedDisplay);
  const prevDisplay = useRef(computedDisplay);

  useEffect(() => {
    if (open) return;
    if (computedDisplay !== prevDisplay.current) {
      prevDisplay.current = computedDisplay;
      setInputText(computedDisplay);
    }
  }, [computedDisplay, open]);

  const handleDayClick = (day: Date) => {
    if (props.range) {
      if (!pendingFrom) {
        setPendingFrom(day);
        return;
      }
      const [a, b] = isBefore(day, pendingFrom)
        ? [day, pendingFrom]
        : [pendingFrom, day];
      props.onRangeChange?.({ dateFrom: a, dateTo: b });
      setPendingFrom(null);
      setOpen(false);
    } else {
      props.onChange?.(day);
      setOpen(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    if (props.range) {
      const parts = val.split("–").map((s) => s.trim());
      const from = parseDisplayDate(parts[0] ?? "");
      const to = parseDisplayDate(parts[1] ?? "");
      if (from && to) {
        props.onRangeChange?.({ dateFrom: from, dateTo: to });
        setMonth(from);
      }
    } else {
      const d = parseDisplayDate(val);
      if (d) {
        props.onChange?.(d);
        setMonth(d);
      }
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      const focused = (props.range ? props.dateFrom : props.value) ?? null;
      if (focused) setMonth(focused);
    } else {
      setPendingFrom(null);
      setInputText(computedDisplay);
    }
    setOpen(next);
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <div onClick={() => !disabled && setOpen(true)}>
          <Input
            id={id}
            label={label}
            required={required}
            disabled={disabled}
            size={size}
            block
            placeholder={placeholder}
            value={inputText}
            name={name}
            className={cn("cursor-pointer", className)}
            onChange={handleInputChange}
          />
        </div>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className={cn(
            "z-50 bg-backgroundDark border border-borderDark rounded-lg overflow-hidden p-2",
            "w-[var(--radix-popover-trigger-width)] min-w-64",
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <CalendarHeader
            month={month}
            onPrev={() => setMonth(addMonths(month, -1))}
            onNext={() => setMonth(addMonths(month, 1))}
          />
          <CalendarGrid
            month={month}
            rangeFrom={
              props.range ? (pendingFrom ?? props.dateFrom) : undefined
            }
            rangeTo={
              props.range ? (pendingFrom ? null : props.dateTo) : undefined
            }
            hovered={props.range ? hovered : undefined}
            onDayClick={handleDayClick}
            onDayHover={props.range ? setHovered : undefined}
            onMonthChange={setMonth}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export { DateInput as DatePicker };
