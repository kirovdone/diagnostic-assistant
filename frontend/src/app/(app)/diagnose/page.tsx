"use client";

// The product: one column, one conversation, one input.
//
// The composer never moves in the tree. Before anything is typed it sits in the middle of
// the page under the question; once the conversation starts it is the same element at the
// bottom of the transcript, so nothing unmounts and nothing is retyped.
//
// The ranking is part of the assistant's reply, not a panel beside it. That is a change
// of mind worth stating: a pinned panel keeps the parts list stable while the user
// answers, which is real, but it also reads as a dashboard to consult rather than an
// answer to what was just asked, and the people using this are not dashboard readers.
// Each turn carries the ranking it was written with, so scrolling back shows what the
// user was actually looking at rather than the latest numbers pasted over history.

import { useCallback, useEffect, useRef, useState } from "react";

import { ChatTurn } from "@/components/diagnose/ChatTurn";
import { ConfirmCause } from "@/components/diagnose/ConfirmCause";
import { EvidenceCase } from "@/components/diagnose/EvidenceCase";
import { QuestionOptions } from "@/components/diagnose/QuestionOptions";
import { RankingAnswer } from "@/components/diagnose/RankingAnswer";
import { ChatComposer } from "@/components/kit/chat/ChatComposer";
import { Button } from "@/components/kit/ui/Button";
import { Icon } from "@/components/kit/ui/Icon";
import { ApiError, getCase } from "@/helpers/api/diagnosticAssist";
import { cn } from "@/helpers/common/cn";
import { sendNotification } from "@/helpers/common/sendNotification";
import useTranslation from "@/helpers/i18n/useTranslation";
import { useBreadcrumbs } from "@/hooks/dashboard/useBreadcrumbs";
import { translateTurn } from "@/helpers/diagnostics/translateTurn";
import { useDiagnosisSession } from "@/hooks/diagnose/useDiagnosisSession";
import type { EvidenceCase as EvidenceCaseData } from "@/types/diagnostics";
import {
  BatteryLowIcon,
  DropletIcon,
  VolumeHighIcon,
  WrenchIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import { useAppContext } from "../appContext";

// Origin: the design system's STARTER_PROMPTS, for this corpus. Chosen to cover the three ways the
// machine gets resolved and the one way it does not: shorthand naming a part, German
// naming a part, French naming a part, and a description that names nothing at all, which
// is the one that makes the system ask rather than guess.
const STARTERS: { label: string; prompt: string; icon: IconSvgElement }[] = [
  {
    label: "Boom leak",
    icon: DropletIcon,
    prompt: "hyd. lk @ boom cyl, ~1 drp/min",
  },
  {
    label: "Knocking",
    icon: VolumeHighIcon,
    prompt: "Klopfgeraeusch im Zylinder, wird unter Last lauter",
  },
  {
    label: "Fuite",
    icon: WrenchIcon,
    prompt:
      "Fuite importante au niveau du verin de fleche, flaque sous la machine",
  },
  {
    label: "Won't start",
    icon: BatteryLowIcon,
    prompt: "Battery dead again, third time this month",
  },
];

export default function DiagnosePage() {
  const { t, lang } = useTranslation("common");
  const { session, pending, error, turns, start, answer, detail, finish, reset } =
    useDiagnosisSession();

  // One field, one value, whichever turn it is.
  const [draft, setDraft] = useState("");
  // Opening an evidence case is an event, not a synchronisation, so the fetch lives in
  // the handler. Held together as one value because the id and its data have to move at
  // the same time: a stale body under a fresh id is a case the user did not ask for.
  const [openCase, setOpenCase] = useState<{
    caseId: string;
    data: EvidenceCaseData | null;
  } | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, pending]);

  const openEvidence = useCallback(
    (caseId: string) => {
      setOpenCase({ caseId, data: null });
      getCase(caseId, lang)
        .then((data) =>
          // Guarded because the user can tap a second case id before the first resolves.
          setOpenCase((current) => (current?.caseId === caseId ? { caseId, data } : current)),
        )
        .catch((caught: unknown) => {
          // The sheet used to open empty and vanish, which reads as a broken button rather
          // than a failed request. The evidence case id is the one thing a technician is
          // asked to check, so a failure to show it has to say so.
          setOpenCase(null);
          const detail = caught instanceof ApiError ? caught.message : "Could not load the case";
          sendNotification("error", t(detail));
        });
    },
    [lang, t],
  );

  // One path out of the composer for every turn: open the session, answer the question on
  // the table, or add detail to the description and re-rank.
  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft("");
    if (!session) {
      setOpenCase(null);
      start({ description: text });
    } else if (session.question) {
      answer(session.question.question_id, text);
    } else {
      // More description on the session already open. Restarting here would have thrown
      // away the answers and refunded the three-question budget.
      detail(text);
    }
  }, [answer, detail, draft, pending, session, start]);

  // The hook owns the error; this raises it once, as a toast, the way the design system raises
  // every API failure. An effect rather than a call site because the error can arrive
  // from either the REST call or the stream.
  useEffect(() => {
    if (error) sendNotification("error", t(error));
  }, [error, t]);

  const isClosed = session?.status === "CLOSED";
  const lastTurn = turns[turns.length - 1];

  const { setBreadcrumbs } = useAppContext();
  useBreadcrumbs(setBreadcrumbs, [
    { label: t("Diagnose"), link: "/diagnose" },
    ...(session?.equipment_type ? [{ label: session.equipment_type }] : []),
  ]);

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] min-h-0 w-full max-w-3xl flex-col gap-3 p-3">
      {!session && (
        <h1 className="mt-auto text-balance pb-8 text-center text-[clamp(22px,2.6vw,30px)] font-semibold leading-[1.12] tracking-[-0.015em] text-text">
          {t("What is the machine doing?")}
        </h1>
      )}

      {session && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-app">
          <div role="log" aria-live="polite" className="mt-auto space-y-3 pb-3">
            {turns.map((turn) => (
              <ChatTurn
                key={turn.id}
                author={turn.author}
                meta={turn.author === "system" ? turn.meta : undefined}
              >
                {/* A question is asked after the ranking, not before it: "here is what
                    the corpus says, and this is what would narrow it". Anything else the
                    assistant says leads, because it is about the answer below it. Keeping
                    the prompt with its own buttons matters more than either: they used to
                    sit at opposite ends of a five-row list, so by the time you reached
                    "Yes, E207" the question was off the top of the screen. */}
                {!turn.view?.question && (
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-text">
                    {translateTurn(t, turn.text)}
                  </p>
                )}

                {/* The answer, inside the answer. */}
                {turn.view && (
                  <RankingAnswer
                    view={turn.view}
                    onEvidenceClick={openEvidence}
                  />
                )}

                {turn.view?.question && (
                  <div className="flex flex-col gap-2 pt-0.5">
                    <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-text">
                      {translateTurn(t, turn.text)}
                    </p>

                    {/* Only the live question is answerable. An older one's buttons scroll
                        away with the turn that asked rather than staying clickable. */}
                    {turn.id === lastTurn?.id && !isClosed && (
                      <QuestionOptions
                        options={turn.view.question.options}
                        disabled={pending}
                        onSelect={(value) =>
                          answer(turn.view!.question!.question_id, value)
                        }
                      />
                    )}
                  </div>
                )}
              </ChatTurn>
            ))}

            {pending && <ChatTurn author="system" thinking />}

            {/* The close is the last thing the conversation does, and that press is the
              only ground truth this product produces. */}
            {!session.question && !isClosed && !pending && lastTurn?.view && (
              <ConfirmCause
                candidates={lastTurn.view.ranking.candidates}
                pending={pending}
                onConfirm={finish}
              />
            )}

            {isClosed && (
              <ChatTurn author="system">
                <p>
                  {session.confirmed_cause_id
                    ? t(
                        "Recorded. That goes back into the corpus as tomorrow's evidence.",
                      )
                    : t(
                        "Recorded as none of these. That is the honest outcome, and the one thing it cannot capture is what the cause actually was.",
                      )}
                </p>
              </ChatTurn>
            )}

            {openCase && (
              <EvidenceCase
                caseId={openCase.caseId}
                data={openCase.data}
                onClose={() => setOpenCase(null)}
              />
            )}

            <div ref={endRef} />
          </div>
        </div>
      )}

      {/* The same element in both states. Only the frame around it moves. */}
      <div
        className={cn(
          "shrink-0 space-y-2",
          !session && "mx-auto mb-auto w-full max-w-lg",
        )}
      >
        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSubmit={send}
          placeholder={
            !session
              ? "hyd. lk @ boom cyl, ~1 drp/min"
              : session.question
                ? t("Answer, or type what you see")
                : t("Add anything else you have been told")
          }
          disabled={pending || isClosed}
          submitDisabled={!draft.trim() || pending || isClosed}
        />

        {!session && (
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {STARTERS.map((starter) => (
              <Button
                key={starter.label}
                size="small"
                disabled={pending}
                icon={<Icon icon={starter.icon} />}
                label={t(starter.label)}
                onClick={() => setDraft(starter.prompt)}
              />
            ))}
          </div>
        )}

        {isClosed && (
          <div className="flex justify-center pt-1">
            <Button size="small" label={t("Start over")} onClick={reset} />
          </div>
        )}
      </div>
    </div>
  );
}
