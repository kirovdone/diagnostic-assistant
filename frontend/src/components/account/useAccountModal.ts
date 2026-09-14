// Origin: the in-house design system, src/components/account/useAccountModal.ts. Copied unchanged.
"use client";

import { DEFAULT_ACCOUNT_TAB } from "@/components/account/tabs";
import { createModalTabStore, useModalTab } from "@/hooks/common/useModalTab";

const store = createModalTabStore<string>();

export const useAccountModal = () => useModalTab(store, DEFAULT_ACCOUNT_TAB);
