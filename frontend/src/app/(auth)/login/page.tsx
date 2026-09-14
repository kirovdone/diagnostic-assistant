"use client";

// Sign in.
//
// the design system's login page markup, class for class: the fixed full-height column, the
// bordered nav strip with the mark in it, the centred `max-w-md` stack, the `text-2xl`
// heading, and a form of Input plus a solid full-width Button. What is not here is what
// this project does not have: Google, the or-divider, and the privacy and terms links.
//
// the design system signs in through next-auth and redirects with useSession. There is no server
// here, so the same two effects are driven by `useAuth` instead. Errors go to the design system's
// Sonner toast through its own sendNotification, as they do on its login page.

import { Button } from "@/components/kit/ui/Button";
import { Icon } from "@/components/kit/ui/Icon";
import { Input } from "@/components/kit/ui/Input";
import { sendNotification } from "@/helpers/common/sendNotification";
import useTranslation from "@/helpers/i18n/useTranslation";
import { useAuth } from "@/hooks/auth/useAuth";
import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

export default function LoginPage() {
  const { t } = useTranslation("common");
  const { user, loading, signIn } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  // Already signed in, or signed in in another tab: there is nothing to do here.
  useEffect(() => {
    if (user) router.replace("/diagnose");
  }, [user, router]);

  const handleLogin = (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password || pending) return;
    setPending(true);
    signIn(username.trim(), password)
      .then(() => router.replace("/diagnose"))
      .catch((cause: Error) => {
        sendNotification("error", t(cause.message));
        setPending(false);
      });
  };

  const anyLoading = pending || loading;

  return (
    <div className="fixed inset-0 flex flex-col overflow-y-auto scrollbar-app text-text">
      <nav className="flex items-center gap-3 w-full px-4 z-40 h-13 shrink-0 border-b border-borderDark">
        <span className="shrink-0 flex items-center gap-2 h-7 text-sm font-medium">
          <Icon icon={Analytics01Icon} />
          Diagnostic Assist
        </span>
      </nav>

      <div className="relative flex w-full flex-1 flex-col items-center justify-center gap-3 p-8">
        <div className="w-full max-w-md flex flex-col items-center text-center space-y-3">
          <h1 className="text-2xl font-semibold">{t("Login")}</h1>

          <form onSubmit={handleLogin} className="w-full space-y-3">
            <Input
              label={t("Email")}
              name="username"
              type="email"
              autoComplete="username"
              value={username}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
              disabled={anyLoading}
              required
              block
            />
            <Input
              label={t("Password")}
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              disabled={anyLoading}
              required
              block
            />
            <Button
              variant="solid"
              type="submit"
              block
              justifyContent="center"
              loading={pending}
              disabled={!username.trim() || !password}
              label={t("Log in")}
            />
          </form>
        </div>

        {/* the design system's privacy and terms links sit here. The one seeded account, printed
            because a take-home nobody can run is not a take-home. */}
        <div className="absolute bottom-5 flex gap-2 text-[11px] text-textLight">
          {t("Demo account: user@test.com / user")}
        </div>
      </div>
    </div>
  );
}
