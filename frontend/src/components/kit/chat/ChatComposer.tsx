"use client";

// Origin: the in-house design system, src/chat/ui/ChatComposer.tsx. Copied to keep this app native to the design system.
//
// Changes from the original, both recorded in COMPONENTS.md:
//
//   - import paths rewritten for this app.
//   - `rows` is a prop and defaults to 1, not 3. the design system opens at three because its
//     composer is the page; here it opens at one and grows with what is typed.
//   - resize-none. The original leaves the browser grabber on, which is visible at one
//     row and pointless when the field sizes itself.
//   - py-3 rather than py-2.5, so one row of text plus its padding is exactly the height
//     of the send button plus its margin: 20 + 12 + 12 against 32 + 6 + 6. At py-2.5 the
//     button was two pixels taller than the field it sits in.
//   - the send button is round, and so is the field. the design system's are rounded-lg and
//     rounded-xl, which read as a form; a single round row reads as something you talk
//     into, which is what this is.

import { Button } from "@/components/kit/ui/Button";
import { Input } from "@/components/kit/ui/Input";
import { MAX_LENGTH_INPUT } from "@/consts/input";
import { cn } from "@/helpers/common/cn";
import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/kit/ui/Icon";
import useTranslation from "@/helpers/i18n/useTranslation";
import type { ChangeEvent, KeyboardEvent, RefObject } from "react";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  submitDisabled?: boolean;
  showSubmit?: boolean;
  className?: string;
  maxLength?: number;
  rows?: number;
  autoFocus?: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
}

export const ChatComposer = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled = false,
  submitDisabled,
  className,
  showSubmit = true,
  maxLength,
  rows = 1,
  autoFocus,
  inputRef,
}: ChatComposerProps) => {
  const { t } = useTranslation("common");

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (!submitDisabled) onSubmit();
  };

  return (
    <div
      className={cn(
        "relative bg-backgroundDark border border-borderDark rounded-full shadow-xs transition duration-200",
        className,
      )}
    >
      <Input
        ref={inputRef}
        name="prompt"
        id="prompt"
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          onChange(e.target.value)
        }
        onKeyDown={handleKeyDown}
        value={value}
        maxLength={maxLength ?? MAX_LENGTH_INPUT.message}
        className="resize-none px-4 py-3 pr-12 !border-0 !bg-transparent !ring-0 !outline-none focus:!ring-0 focus:!outline-none focus-visible:!outline-none rounded-full"
        type="textarea"
        rows={rows}
        block
        disabled={disabled}
      />
      {showSubmit && (
        <div className="absolute bottom-0 right-0 m-1.5 flex items-center gap-2">
          <Button
            size="small"
            variant="accent"
            justifyContent="center"
            className="rounded-full"
            icon={<Icon icon={ArrowUp02Icon} />}
            disabled={submitDisabled}
            onClick={onSubmit}
            tooltipLabel={t("Send")}
          />
        </div>
      )}
    </div>
  );
};
