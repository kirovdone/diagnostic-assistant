"use client";

// Changing the password.
//
// the design system has no panel for this: its passwords live in next-auth and its users sign in
// with a link or with Google, so there is nothing to change. This project authenticates
// with a password, so the panel exists, and it is built out of the same parts the design system's
// ProfilePanel is: Inputs, a Callout, and the accent Update button bottom-right.

import { Button } from "@/components/kit/ui/Button";
import { Input } from "@/components/kit/ui/Input";
import { sendNotification } from "@/helpers/common/sendNotification";
import useTranslation from "@/helpers/i18n/useTranslation";
import { useAuth } from "@/hooks/auth/useAuth";
import { useState, type ChangeEvent, type FormEvent } from "react";

// Mirrors MIN_PASSWORD_LENGTH in the backend's config.py, which is where the number and
// the argument for it live. Display only: the server decides, this is what stops the user
// finding out after a round trip.
const MIN_PASSWORD_LENGTH = 4;

export function PasswordPanel() {
  const { t } = useTranslation("common");
  const { user, changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pending, setPending] = useState(false);

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const ready = current.length > 0 && next.length >= MIN_PASSWORD_LENGTH;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready || pending) return;
    setPending(true);
    changePassword(current, next)
      .then(() => {
        sendNotification("success", t("Password changed"));
        setCurrent("");
        setNext("");
      })
      // `count` is only read by the too-short message; the others have no placeholder and
      // ignore it. Passing it here rather than baking the number into useAuth keeps the
      // floor in one place on this side of the wire.
      .catch((cause: Error) =>
        sendNotification("error", t(cause.message, { count: MIN_PASSWORD_LENGTH })),
      )
      .finally(() => setPending(false));
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* Hidden, and there for password managers rather than for the user: a change-password
          form with no username field gives them nothing to file the new password against,
          and Chrome says so in the console. */}
      <input
        type="text"
        name="username"
        autoComplete="username"
        value={user?.username ?? ""}
        readOnly
        hidden
      />
      <Input
        label={t("Current password")}
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setCurrent(event.target.value)}
        block
      />
      <Input
        label={t("New password")}
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setNext(event.target.value)}
        block
      />
      {tooShort && (
        <p className="text-xs text-textLight">
          {t("At least {{count}} characters.", { count: MIN_PASSWORD_LENGTH })}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          variant="accent"
          size="small"
          type="submit"
          loading={pending}
          disabled={!ready}
          label={t("Update")}
        />
      </div>
    </form>
  );
}
