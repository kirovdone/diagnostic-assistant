// The one place that knows the backend's URL and shape.
//
// the design system keeps its browser fetch wrapper at helpers/api/handleApiRequest.ts and this
// follows that convention. The base URL is a build-time public env var because the bundle
// is a static export: there is no server to read configuration at request time.

import type { EvidenceCase, LabelRow, LoginResponse, SessionView, User } from "@/types/diagnostics";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// The bearer token, held in module scope rather than passed down through every call.
//
// It is not in localStorage. A static page on its own origin has no httpOnly cookie to
// hide behind, so the realistic choice is between a token any script on the page can read
// forever and one that dies with the tab. This is the second: a refresh signs the user in
// again from the stored session below only if that session is still valid server-side.
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

// What to do when the server stops accepting the token we hold. Registered by the auth
// provider rather than imported, so this module keeps knowing only about the backend.
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    // An expired or revoked token is not an error for the caller to report: it means this
    // browser is no longer signed in, and every later call would fail the same way. Sign-in
    // itself is excluded, where a 401 is a wrong password and the form has to say so.
    if (response.status === 401 && !path.startsWith("/auth/login")) onUnauthorized?.();
    // Prefer the backend's own `detail`. Without this every failure reads
    // "POST /sessions failed with 503" and the reason is thrown away.
    let detail: string | undefined;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      detail = undefined;
    }
    throw new ApiError(
      detail ?? `${init?.method ?? "GET"} ${path} failed with ${response.status}`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

// Called on load rather than trusting the stored user beside the token, so a token that
// expired overnight logs the browser out instead of showing a signed-in shell over an API
// that returns 401 to everything.
export function me(): Promise<User> {
  return request<User>("/auth/me");
}

export function updateProfile(name: string): Promise<User> {
  return request<User>("/auth/me", { method: "PATCH", body: JSON.stringify({ name }) });
}

// Returns a fresh token, because the server issues one and the old one stops verifying:
// tokens are signed with a key that includes the password hash, so changing the password
// revokes every token issued before it. Adopting the new one here is what keeps this tab
// signed in through its own password change.
export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

// One field. The backend reads the machine out of the description where it can and asks
// where it cannot, so nothing here picks an equipment family on the user's behalf.
export function createSession(body: {
  description: string;
  language: string;
}): Promise<SessionView> {
  return request<SessionView>("/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// The language is a query parameter rather than a body field because this is a GET, and the
// server renders in it without storing it: a read must not mutate shared state, or two tabs on
// different locales fight over one field. The session's own language is set on create and moves
// with an answer, which is where a dispatcher actually switches it.
export function getSession(sessionId: string, language?: string): Promise<SessionView> {
  const query = language ? `?language=${encodeURIComponent(language)}` : "";
  return request<SessionView>(`/sessions/${sessionId}${query}`);
}

// Idempotent by question_id on the server, so a retry after a dropped connection is safe
// to fire without checking what landed first.
export function submitAnswer(
  sessionId: string,
  body: { question_id: string; value: string; language: string },
): Promise<SessionView> {
  return request<SessionView>(`/sessions/${sessionId}/answers`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// More description, once the questions have run out. Not a new session: the answers already
// given still hold, and the three-question budget is not refunded.
export function addDetail(
  sessionId: string,
  body: { text: string; language: string },
): Promise<SessionView> {
  return request<SessionView>(`/sessions/${sessionId}/details`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function closeSession(
  sessionId: string,
  confirmedCauseId: string | null,
): Promise<SessionView> {
  return request<SessionView>(`/sessions/${sessionId}/close`, {
    method: "POST",
    body: JSON.stringify({ confirmed_cause_id: confirmedCauseId }),
  });
}

// The review queue localises its cause names like every other call that produces one, so
// a German dispatcher does not read English causes under a German menu.
export function listCases(language: string): Promise<LabelRow[]> {
  return request<LabelRow[]>(`/cases?language=${encodeURIComponent(language)}`);
}

export function getCase(caseId: string, language: string): Promise<EvidenceCase> {
  // The cause name is localised by the server, like every other ranking call.
  return request<EvidenceCase>(`/cases/${caseId}?language=${encodeURIComponent(language)}`);
}

// EventSource cannot set a header, so the credential rides in the query string and lands in
// every access log. That is why this is a ticket the server mints with each view -- sixty
// seconds, bound to this session id -- and not the bearer token, which is good for twelve
// hours everywhere. The backend's stream_events docstring carries the same argument.
export function eventStreamUrl(sessionId: string, ticket: string): string {
  return `${API_URL}/sessions/${sessionId}/events?ticket=${encodeURIComponent(ticket)}`;
}
