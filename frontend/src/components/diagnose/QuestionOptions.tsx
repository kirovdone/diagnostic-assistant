"use client";

// The answers to the question the assistant just asked, offered inside its message.
//
// Origin of the shape: the design system's `OptionsGroup` in src/chat/ui/ChatOptions.tsx — a
// stacked list of full-width `solid` buttons that wrap rather than truncate, capped and
// scrolled at max-h-72. the design system renders it above the composer; here it belongs to the
// turn that asked, so an old question's buttons scroll away with it instead of staying
// live under a newer answer.
//
// The same width as the ranking beside it, because they are the same kind of thing: what
// the assistant put in front of you to act on.
//
// These are a shortcut and never the only way in. The true answer is often not on a
// button: C-49002 (alternator) and C-49040 (battery) both present as a dead machine, and
// only free text separates them. Whatever is typed is appended to the description and
// everything re-ranks, so typing costs nothing a tap does not.

import { Button } from "@/components/kit/ui/Button";
import { translateTurn } from "@/helpers/diagnostics/translateTurn";
import useTranslation from "@/helpers/i18n/useTranslation";
import type { AnswerOption } from "@/types/diagnostics";

interface QuestionOptionsProps {
  options: AnswerOption[];
  disabled: boolean;
  onSelect: (value: string) => void;
}

export function QuestionOptions({ options, disabled, onSelect }: QuestionOptionsProps) {
  const { t } = useTranslation("common");
  if (options.length === 0) return null;
  return (
    <ul className="flex max-h-72 max-w-sm flex-col gap-1.5 overflow-y-auto scrollbar-app">
      {options.map((option) => (
        <li key={option.value}>
          <Button
            variant="solid"
            size="small"
            block
            justifyContent="start"
            label={translateTurn(t, option.label)}
            disabled={disabled}
            onClick={() => onSelect(option.value)}
            className="h-auto whitespace-normal py-1.5 text-left [&>span]:overflow-visible [&>span]:whitespace-normal"
          />
        </li>
      ))}
    </ul>
  );
}
