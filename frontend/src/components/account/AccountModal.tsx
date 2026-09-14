"use client";

// Origin: the in-house design system, src/components/account/AccountModal.tsx.
//
// Markup, classes and structure copied: the same `Modal` with `hideHeader` and the
// blurred overlay, the same MODAL_SHELL / MODAL_RAIL / MODAL_TABS from consts/styles, the
// tab rail that becomes a horizontal strip under `sm`, the breadcrumb header with the
// close button, and the scrolling panel body inside a ModalHeaderProvider.
//
// Only the panel list is this project's: the design system's Plans, Usage, Cards and Invoices all
// belong to a billing layer that does not exist here.

import { ACCOUNT_TABS } from "@/components/account/tabs";
import { PasswordPanel } from "@/components/account/PasswordPanel";
import { ProfilePanel } from "@/components/account/ProfilePanel";
import { useAccountModal } from "@/components/account/useAccountModal";
import { Breadcrumbs } from "@/components/kit/ui/Breadcrumbs";
import { Button } from "@/components/kit/ui/Button";
import { Icon } from "@/components/kit/ui/Icon";
import { Modal } from "@/components/kit/ui/Modal";
import { ModalHeaderProvider } from "@/components/kit/ui/ModalHeader";
import {
  MODAL_RAIL as RAIL,
  MODAL_SHELL as SHELL,
  MODAL_TABS as TABS,
} from "@/consts/styles";
import useTranslation from "@/helpers/i18n/useTranslation";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { useState, type ReactNode } from "react";

const PANELS: Record<string, () => ReactNode> = {
  profile: ProfilePanel,
  password: PasswordPanel,
};

export const AccountModal = () => {
  const { t } = useTranslation("common");
  const { tab, isOpen, open, close } = useAccountModal();
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);

  const Panel = tab ? PANELS[tab] : undefined;
  const active = ACCOUNT_TABS.find((item) => item.id === tab);

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={t("Account")}
      hideHeader
      overlayClassName="bg-black/40 backdrop-blur-xs"
      className={SHELL}
      content={
        <div className="flex h-full flex-col sm:flex-row">
          <aside className={RAIL}>
            <nav aria-label={t("Account")} className={TABS}>
              {ACCOUNT_TABS.map((item) => (
                <Button
                  key={item.id}
                  size="small"
                  icon={<Icon icon={item.icon} />}
                  label={t(item.label)}
                  disabled={item.id === tab}
                  onClick={() => open(item.id)}
                  className="shrink-0 overflow-hidden sm:w-full"
                />
              ))}
            </nav>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex flex-none items-center gap-2 border-b border-borderDark p-3">
              <div className="min-w-0 flex-1">
                <Breadcrumbs
                  items={[{ label: t("Account") }, ...(active ? [{ label: t(active.label) }] : [])]}
                />
              </div>
              {headerActions}
              <Button
                size="small"
                justifyContent="center"
                icon={<Icon icon={Cancel01Icon} />}
                onClick={close}
                name={t("Close")}
              />
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto scrollbar-app p-3 text-sm">
              <ModalHeaderProvider value={setHeaderActions}>
                {Panel ? <Panel /> : null}
              </ModalHeaderProvider>
            </div>
          </div>
        </div>
      }
    />
  );
};
