"use client";

// One diagnosis session: the REST calls, the SSE stream, and the rule for reconciling
// the two.
//
// Both channels carry the same state. The POST responses are complete views and the
// stream is a push of the same updates, so the risk is applying them out of order and
// showing a ranking that has already been superseded. Every event and every response
// carries `seq`, so the rule is simply: never apply anything older than what is on
// screen. That also makes a reconnect free, because the stream replays from the queue
// and the stale events are discarded on arrival.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ApiError,
  closeSession,
  createSession,
  eventStreamUrl,
  submitAnswer,
} from "@/helpers/api/diagnosticAssist";
import useTranslation from "@/helpers/i18n/useTranslation";
import type { DiagnosisEvent, SessionView } from "@/types/diagnostics";

// What the assistant says when it has nothing left worth asking. The server decides that,
// not the screen: it stops when no question clears MIN_INFORMATION_GAIN_BITS.
const REVIEW_PROMPT =
  "That is everything worth asking. Here is what the corpus says — confirm which one it turned out to be.";

interface StartInput {
  description: string;
}

// One line of the conversation. Kept here rather than derived from `answers`, because a
// transcript is ordered and that map is not: it records what was answered, not when.
export interface Turn {
  id: string;
  author: "user" | "system";
  text: string;
  meta?: string;
  // The ranking as it stood when this turn was written. A snapshot, not a reference: the
  // transcript is a record of what the user was shown, and a later re-rank must not
  // rewrite what an earlier answer said.
  view?: SessionView;
}

export interface DiagnosisSession {
  session: SessionView | null;
  pending: boolean;
  error: string | null;
  // Sticky once the server has said the evidence is thin. It does not un-say it when a
  // later event happens to arrive without the flag: the user needs the caveat to stay
  // attached to the answer they are reading.
  degraded: boolean;
  streaming: boolean;
  turns: Turn[];
  start: (input: StartInput) => Promise<void>;
  answer: (questionId: string, value: string) => Promise<void>;
  finish: (causeId: string | null) => Promise<void>;
  reset: () => void;
}

export function useDiagnosisSession(): DiagnosisSession {
  const [session, setSession] = useState<SessionView | null>(null);
  // The taxonomy carries a cause label per language, so the locale rides on every call
  // that produces a ranking. Without it a German dispatcher reads a German UI listing
  // English cause names, which is the one place a half-translated screen misleads.
  const { lang } = useTranslation("common");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);

  const say = useCallback(
    (author: "user" | "system", text: string, view?: SessionView, meta?: string) => {
      setTurns((current) => [
        ...current,
        { id: `${current.length}-${author}-${Date.now()}`, author, text, meta, view },
      ]);
    },
    [],
  );

  const seqRef = useRef(0);
  const sourceRef = useRef<EventSource | null>(null);

  const closeStream = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    setStreaming(false);
  }, []);

  useEffect(() => closeStream, [closeStream]);

  const applyView = useCallback((view: SessionView) => {
    seqRef.current = Math.max(seqRef.current, view.seq);
    setSession(view);
    if (view.ranking.degraded) setDegraded(true);
  }, []);

  const openStream = useCallback(
    (sessionId: string) => {
      closeStream();
      const source = new EventSource(eventStreamUrl(sessionId));
      sourceRef.current = source;
      setStreaming(true);

      const handle = (raw: MessageEvent<string>, name: DiagnosisEvent["event"]) => {
        const payload = JSON.parse(raw.data) as DiagnosisEvent;
        if (payload.seq <= seqRef.current) return;
        seqRef.current = payload.seq;

        setSession((current) => {
          if (!current) return current;
          if (payload.ranking) return { ...current, ranking: payload.ranking };
          if (name === "question" && payload.question) {
            return { ...current, question: payload.question };
          }
          if (name === "done") return { ...current, question: null };
          return current;
        });

        if (name === "degraded") setDegraded(true);
        if (name === "done") closeStream();
      };

      for (const name of [
        "candidates.initial",
        "candidates.updated",
        "question",
        "degraded",
        "done",
      ] as const) {
        source.addEventListener(name, (raw) =>
          handle(raw as MessageEvent<string>, name),
        );
      }

      // The stream is an optimisation, not the contract. Every POST already returns the
      // full view, so losing the socket degrades the page to request-response rather
      // than breaking it, and there is nothing for the user to do about it.
      source.onerror = () => setStreaming(false);
    },
    [closeStream],
  );

  const start = useCallback(
    async (input: StartInput) => {
      setPending(true);
      setError(null);
      setDegraded(false);
      seqRef.current = 0;
      setTurns([]);
      say("user", input.description);
      try {
        const view = await createSession({ ...input, language: lang });
        applyView(view);
        say("system", view.question ? view.question.prompt : REVIEW_PROMPT, view);
        openStream(view.session_id);
      } catch (caught) {
        const status = caught instanceof ApiError ? caught.status : undefined;
        if (status === 503) {
          setError(
            "Diagnosis is unavailable: the service cannot reach its models right now. " +
              "Nothing is guessed when that happens.",
          );
        } else {
          setError(caught instanceof Error ? caught.message : "Could not reach the backend");
        }
      } finally {
        setPending(false);
      }
    },
    [applyView, lang, openStream, say],
  );

  const answer = useCallback(
    async (questionId: string, value: string) => {
      if (!session) return;
      setPending(true);
      say("user", value);
      try {
        const view = await submitAnswer(session.session_id, {
          question_id: questionId,
          value,
          language: lang,
        });
        applyView(view);
        say("system", view.question ? view.question.prompt : REVIEW_PROMPT, view);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not send the answer");
      } finally {
        setPending(false);
      }
    },
    [applyView, lang, say, session],
  );

  // Closing is refused by the server once a session is closed, because the confirmed cause is
  // the only ground truth the product produces and a retry must not be able to blank it. So the
  // button is not offered twice: the guard here is what keeps a double tap from becoming an
  // error message about something that already worked.
  const finish = useCallback(
    async (causeId: string | null) => {
      if (!session || session.status === "CLOSED") return;
      setPending(true);
      try {
        applyView(await closeSession(session.session_id, causeId));
        closeStream();
      } catch (caught) {
        const status = caught instanceof ApiError ? caught.status : undefined;
        if (status === 409) {
          // Someone else closed it first — the technician on their own screen, most likely.
          // That is the outcome we wanted, so reconcile rather than complain.
          closeStream();
        } else if (status === 422) {
          setError("That cause is not in the current taxonomy. Reload and try again.");
        } else {
          setError(caught instanceof Error ? caught.message : "Could not close the session");
        }
      } finally {
        setPending(false);
      }
    },
    [applyView, closeStream, session],
  );

  const reset = useCallback(() => {
    closeStream();
    seqRef.current = 0;
    setSession(null);
    setDegraded(false);
    setError(null);
    setTurns([]);
  }, [closeStream]);

  return { session, pending, error, degraded, streaming, turns, start, answer, finish, reset };
}
