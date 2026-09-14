"use client";

// One turn in the transcript.
//
// Origin: the in-house design system, `MessageBubble` in src/chat/ui/MessageBubble.tsx — the same shape and
// the same classes. A user turn is a `bg-backgroundLight/70` block capped at 90% of the
// column; an assistant turn is full width with no bubble at all, which is what makes the
// answer read as the page talking rather than as a card someone dropped in.
//
// What is dropped from the original: steps, images, credit and duration meta. Those
// belong to a build agent streaming tool calls. This turn has one thing to say and
// sometimes a ranking under it.

import type { ReactNode } from "react";

import { ThinkingDots } from "@/components/kit/chat/ThinkingDots";
import { cn } from "@/helpers/common/cn";
import useTranslation from "@/helpers/i18n/useTranslation";

export type TurnAuthor = "user" | "system";

interface ChatTurnProps {
  author: TurnAuthor;
  children?: ReactNode;
  meta?: string;
  thinking?: boolean;
}

export function ChatTurn({ author, children, meta, thinking = false }: ChatTurnProps) {
  const { t } = useTranslation("common");
  const isUser = author === "user";

  return (
    <div
      role="article"
      aria-label={isUser ? t("You") : t("Assistant")}
      className={cn("flex min-w-0", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "space-y-2 rounded-lg text-sm",
          isUser && "max-w-[90%] bg-backgroundLight/70 px-3 py-2",
          !isUser && "w-full",
        )}
      >
        {thinking && <ThinkingDots />}
        {children}
        {meta && <div className="text-sm text-textLight">{meta}</div>}
      </div>
    </div>
  );
}
