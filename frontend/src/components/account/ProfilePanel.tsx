"use client";

// Origin: the in-house design system, src/components/account/ProfilePanel.tsx.
//
// Same shape: a form of the design system Inputs with the accent Update button bottom-right, the
// email disabled because it identifies the account, the name editable. What is gone is
// what has no backing here: the design system's Dropzone for the avatar, its LocationField and
// address, and the Meta title. What is added is nothing.

import { Button } from "@/components/kit/ui/Button";
import { Input } from "@/components/kit/ui/Input";
import { sendNotification } from "@/helpers/common/sendNotification";
import useTranslation from "@/helpers/i18n/useTranslation";
import { useAuth } from "@/hooks/auth/useAuth";
import { useState, type ChangeEvent, type FormEvent } from "react";

export function ProfilePanel() {
  const { t } = useTranslation("common");
  const { user, updateName } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [pending, setPending] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || pending) return;
    setPending(true);
    updateName(name.trim())
      .then(() => sendNotification("success", t("Profile updated")))
      .catch(() => sendNotification("error", t("Profile not updated")))
      .finally(() => setPending(false));
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input label={t("Username")} value={user?.username ?? ""} disabled block />
      {/* Disabled for the same reason the design system disables it: it is the identity, and
          changing an identifier is a different operation with a verification step. */}
      <Input label={t("Email")} value={user?.email ?? ""} disabled block />
      <Input
        label={t("Name")}
        value={name}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
        block
      />
      <div className="flex justify-end">
        <Button
          variant="accent"
          size="small"
          type="submit"
          loading={pending}
          disabled={!name.trim() || name.trim() === user?.name}
          label={t("Update")}
        />
      </div>
    </form>
  );
}
