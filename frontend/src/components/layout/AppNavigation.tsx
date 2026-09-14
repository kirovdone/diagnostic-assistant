"use client";

// The app shell.
//
// Written rather than copied, and that is the one place this project departs from
// reusing the design system wholesale. the design system's AppNavigation is 350 lines wired to credit
// status, notifications, an account menu and a mobile sheet, all fed by hooks that reach
// its auth and billing layers. None of that exists here.
//
// What is copied is its structure and its classes, element for element: the outer
// `h-screen overflow-hidden` frame, the `sticky top-0 h-screen` rail whose width is
// driven by the library's own useSidebarResize, the collapse button in the header, the
// breadcrumb slot, and the content column that scrolls inside itself rather than
// scrolling the page. That last part is why the rail stays put: with a sidebar the
// viewport never scrolls, so the header does not need `sticky` either, which is exactly
// the condition the design system encodes as `!showSidebar && "sticky top-0"`.

import { AccountModal } from "@/components/account/AccountModal";
import { useAccountModal } from "@/components/account/useAccountModal";
import { LocaleFlag } from "@/components/kit/fields/LanguageMenu";
import { Avatar } from "@/components/kit/ui/Avatar";
import { Breadcrumbs } from "@/components/kit/ui/Breadcrumbs";
import { Button } from "@/components/kit/ui/Button";
import { Icon } from "@/components/kit/ui/Icon";
import { LANGUAGES } from "@/consts/languages";
import { ContextLayout } from "@/context";
import { cn } from "@/helpers/common/cn";
import useTranslation from "@/helpers/i18n/useTranslation";
import { useAuth } from "@/hooks/auth/useAuth";
import { useSidebarResize } from "@/hooks/common/useSidebarResize";
import { useLocale } from "@/hooks/i18n/LocaleProvider";
import type { Breadcrumb, ButtonProps, ThemePreference } from "@/types/components";
import {
  Analytics01Icon,
  CheckListIcon,
  ComputerIcon,
  Globe02Icon,
  Logout01Icon,
  Moon02Icon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  Stethoscope02Icon,
  Sun03Icon,
  Tick01Icon,
  User02Icon,
} from "@hugeicons/core-free-icons";
import { usePathname } from "next/navigation";
import { useContext, useMemo, type ReactNode } from "react";

const SCROLL_CLASSES = "scrollbar-app";

const CURRENT_ITEM = "opacity-100 bg-backgroundLight";

// Labels are the English key, translated at render. the design system does the same: its
// NavigationItem labels come out of `t()` in useAppNavigation.
//
// Every destination is reachable by everyone who is signed in. There is no permission
// model here because the product has no second answer to give: whoever diagnoses also
// audits what the labeller did to the corpus they are diagnosing against.
const NAVIGATION = [
  { label: "Diagnose", link: "/diagnose", icon: Stethoscope02Icon },
  { label: "Cases", link: "/cases", icon: CheckListIcon },
];

export function AppNavigation({
  children,
  breadcrumbs,
  navActions,
}: {
  children: ReactNode;
  breadcrumbs: Breadcrumb[];
  navActions: ReactNode;
}) {
  const { t } = useTranslation("common");
  const pathname = usePathname();
  const path = pathname?.replace(/\/$/, "") || "/";
  const { isCollapsed, width, hasMounted, toggle } = useSidebarResize(false);
  const { user, signOut } = useAuth();
  const { themePreference, setThemeMode } = useContext(ContextLayout) ?? {};
  const { lang, setLang } = useLocale();
  const { open: openAccount } = useAccountModal();

  // the design system's theme item, same three modes in the same order, same tick on the current
  // one.
  const themeItem = useMemo<ButtonProps>(() => {
    const modes: { value: ThemePreference; label: string; icon: typeof ComputerIcon }[] = [
      { value: "system", label: t("System"), icon: ComputerIcon },
      { value: "light", label: t("Light"), icon: Sun03Icon },
      { value: "dark", label: t("Dark"), icon: Moon02Icon },
    ];
    return {
      label: t("Theme"),
      icon: <Icon icon={themePreference === "dark" ? Moon02Icon : Sun03Icon} />,
      items: modes.map((mode) => ({
        label: mode.label,
        icon: <Icon icon={mode.icon} />,
        onClick: () => setThemeMode?.(mode.value),
        actions: themePreference === mode.value ? [{ icon: <Icon icon={Tick01Icon} /> }] : undefined,
      })),
    };
  }, [t, themePreference, setThemeMode]);

  // the design system's language item, same shape: the globe on the parent, a flag on each locale,
  // a tick on the current one. the design system's switchLocale then assigns `/de/...`; this is a
  // static export with no locale routes to assign to, so the LocaleProvider writes the
  // same NEXT_LOCALE cookie and swaps the catalogue in place.
  const languageItem = useMemo<ButtonProps>(
    () => ({
      label: t("Language"),
      icon: <Icon icon={Globe02Icon} />,
      items: LANGUAGES.map((language) => ({
        label: language.name,
        icon: <LocaleFlag locale={language.locale} />,
        onClick: () => setLang(language.locale),
        actions: lang === language.locale ? [{ icon: <Icon icon={Tick01Icon} /> }] : undefined,
      })),
    }),
    [t, lang, setLang],
  );

  // The footer, in the design system's shape: a full-width Button whose icon is an Avatar and
  // whose items are the account menu. the design system's has Profile, Billing, Theme, Language
  // and Logout; there is no billing layer here, so what is left is Profile, Theme,
  // Language and Logout.
  const footer = user && (
    <div className="flex flex-none items-center gap-2 border-t border-borderDark pt-3">
      <Button
        size="small"
        justifyItems="start"
        icon={<Avatar label={user.name} size={24} />}
        label={user.name}
        className="min-w-0 flex-1"
        items={[
          {
            label: t("Profile"),
            icon: <Icon icon={User02Icon} />,
            onClick: () => openAccount("profile"),
          },
          themeItem,
          languageItem,
          {
            label: t("Logout"),
            icon: <Icon icon={Logout01Icon} />,
            onClick: signOut,
          },
        ]}
      />
    </div>
  );

  const links = NAVIGATION.map((item) => {
    const isCurrent = path === item.link;
    return (
      <Button
        key={item.link}
        label={t(item.label)}
        link={item.link}
        icon={<Icon icon={item.icon} />}
        size="small"
        block
        prefetch
        disabled={isCurrent}
        className={cn("overflow-hidden", isCurrent && CURRENT_ITEM)}
      />
    );
  });

  const sidebarBody = (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-backgroundLight/50 p-3">
      <div className="flex min-h-0 flex-1 flex-col space-y-3">
        <div className="min-w-0 flex-none border-b border-borderDark pb-3">
          <span className="flex items-center gap-2 px-2 py-1 text-sm font-medium">
            <Icon icon={Analytics01Icon} />
            Diagnostic Assist
          </span>
        </div>
        <div className={cn("min-h-0 min-w-0 flex-1 space-y-2 overflow-y-auto", SCROLL_CLASSES)}>
          {links}
        </div>
      </div>

      {footer}
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mounted once at the shell, the way the design system mounts it in its (app) layout, so a
          tab opened from the account menu survives navigating between pages. */}
      <AccountModal />

      <div
        style={{ width: isCollapsed ? 0 : width }}
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 overflow-hidden border-r border-borderDark lg:flex",
          hasMounted && "transition-width duration-200",
        )}
      >
        <div style={{ width }} className="h-full shrink-0">
          {sidebarBody}
        </div>
      </div>

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <nav
          data-app-header
          className="z-40 flex w-full shrink-0 items-center gap-2 border-b border-borderDark bg-background/70 p-3 text-text backdrop-blur-md"
        >
          <div className="hidden shrink-0 lg:block">
            <Button
              size="small"
              justifyContent="center"
              icon={<Icon icon={isCollapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon} />}
              onClick={toggle}
              name={isCollapsed ? t("Expand sidebar") : t("Collapse sidebar")}
            />
          </div>

          <span className="flex items-center gap-2 text-sm font-medium lg:hidden">
            <Icon icon={Analytics01Icon} />
            Diagnostic Assist
          </span>

          {breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {navActions && <div className="flex items-center gap-2">{navActions}</div>}

            {/* At phone width the rail is gone, so the destinations live in the header.
                Three links, and only for a reviewer, do not earn the design system's slide-over
                Sheet, and the taps stay in the reach zone rather than behind a menu
                button. */}
            <div className="flex items-center gap-2 lg:hidden">{links}</div>
          </div>
        </nav>

        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5",
            SCROLL_CLASSES,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
