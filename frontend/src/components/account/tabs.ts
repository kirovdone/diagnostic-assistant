// Origin: the in-house design system, src/components/account/tabs.ts.
//
// Same shape, same exports. the design system's five tabs are Profile, Plans, Usage, Cards and
// Invoices; four of those belong to a billing layer that does not exist here, so what is
// left is the one that holds account data: Profile, plus the password beside it.
import { LockPasswordIcon, UserIcon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

interface AccountTab {
  id: string;
  label: string;
  icon: IconSvgElement;
}

export const ACCOUNT_PARAM = "account";

export const ACCOUNT_TABS: AccountTab[] = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "password", label: "Password", icon: LockPasswordIcon },
];

export const DEFAULT_ACCOUNT_TAB = "profile";

export const isAccountTab = (value: unknown): value is string =>
  typeof value === "string" && ACCOUNT_TABS.some((tab) => tab.id === value);
