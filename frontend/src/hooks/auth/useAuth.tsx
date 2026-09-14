"use client";

// Who is signed in.
//
// the design system gets this from next-auth's SessionProvider, which needs a server. This is a
// static export talking to a FastAPI backend over CORS, so the same shape is provided
// here by hand: a context with the user, a loading flag while the held token is checked,
// and sign in and out.
//
// The token lives in sessionStorage rather than localStorage. On its own origin a static
// page has no httpOnly cookie to hide behind, so the honest choice is between a token any
// script on the page can read until it expires and one that dies when the tab closes.
// This is the second, and it costs a sign-in per new tab, which for a depot machine
// shared between shifts is the right side of the trade.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  ApiError,
  changePassword as apiChangePassword,
  login as apiLogin,
  me,
  setAuthToken,
  setUnauthorizedHandler,
  updateProfile as apiUpdateProfile,
} from "@/helpers/api/diagnosticAssist";
import type { User } from "@/types/diagnostics";

const TOKEN_KEY = "diagnosticAssistToken";

interface AuthValue {
  user: User | null;
  // True until the token found at load has been checked against the backend. The shell
  // renders nothing decisive during it: a flash of the login page for a user who is in
  // fact signed in is worse than a beat of nothing.
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  updateName: (name: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthValue>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: () => {},
  updateName: async () => {},
  changePassword: async () => {},
});

const readStoredToken = (): string | null => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    // Private windows and locked-down enterprise profiles throw rather than return null.
    return null;
  }
};

const writeStoredToken = (token: string | null): void => {
  try {
    if (token === null) sessionStorage.removeItem(TOKEN_KEY);
    else sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // A browser that will not store it still works; it just signs in once per load.
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const stored = readStoredToken();
    if (stored) setAuthToken(stored);
    // Asks the backend rather than trusting what is in storage: the token may have
    // expired while the tab was closed, and the user beside it may be stale.
    //
    // The no-token case still goes through a resolved promise rather than clearing
    // `loading` inline. Two reasons, and only one of them is the lint rule: a static
    // export prerenders this component, and an initial `loading` that depends on
    // sessionStorage disagrees between the server's HTML and the browser's first render.
    // Starting true on both sides and resolving a microtask later has neither problem.
    const restored = stored
      ? me()
          .then((signedIn) => {
            if (!cancelled) setUser(signedIn);
          })
          .catch((caught: unknown) => {
            // Only a refusal means the token is dead. A network blip on a cold start would
            // otherwise throw away a perfectly good session and ask for the password again.
            if (caught instanceof ApiError && caught.status === 401) {
              setAuthToken(null);
              writeStoredToken(null);
            }
          })
      : Promise.resolve();

    void restored.finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    try {
      const { token, user: signedIn } = await apiLogin(username, password);
      setAuthToken(token);
      writeStoredToken(token);
      setUser(signedIn);
    } catch (error) {
      setAuthToken(null);
      writeStoredToken(null);
      // The message is the English key, translated where it is rendered. 401 is the
      // only failure a person can act on, so it is the only one reworded; anything else
      // is the backend being unreachable and says so.
      throw new Error(
        error instanceof ApiError && error.status === 401
          ? "Wrong username or password."
          : "Could not reach the backend at {{url}}.",
      );
    }
  }, []);

  const updateName = useCallback(async (name: string) => {
    setUser(await apiUpdateProfile(name));
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      const { token } = await apiChangePassword(currentPassword, newPassword);
      // The server hands back a fresh token, and the old one is already dead: tokens are
      // signed with a key that includes the password hash. Holding this one is what keeps
      // the tab that changed the password signed in.
      setAuthToken(token);
      writeStoredToken(token);
    } catch (error) {
      throw new Error(
        error instanceof ApiError && error.status === 401
          ? "Current password is wrong."
          : "Password not changed. It must be at least {{count}} characters.",
      );
    }
  }, []);

  const signOut = useCallback(() => {
    setAuthToken(null);
    writeStoredToken(null);
    setUser(null);
  }, []);

  // A 401 from anywhere means this browser is no longer signed in. Without this every
  // screen toasts its own version of the backend's "invalid or expired token" and the user
  // is left on a signed-in shell where nothing works.
  useEffect(() => {
    setUnauthorizedHandler(signOut);
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const value = useMemo<AuthValue>(
    () => ({ user, loading, signIn, signOut, updateName, changePassword }),
    [user, loading, signIn, signOut, updateName, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  return useContext(AuthContext);
}
