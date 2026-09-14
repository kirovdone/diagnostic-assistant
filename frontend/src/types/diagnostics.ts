// The wire format of the FastAPI backend, mirrored by hand.
//
// Hand-written rather than generated from the OpenAPI schema, which is a deliberate
// choice for a project this size and would not survive contact with a real team: the
// backend already publishes /openapi.json, and generating this file in CI is how the two
// stay honest. It is on the cut list in the design note.

export interface User {
  // The email. It is what a person is given and what they type.
  username: string;
  name: string;
  email: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export type OutcomeStatus =
  | "CONFIRMED"
  | "PROVISIONAL"
  | "NO_FAULT_FOUND"
  | "NON_DIAGNOSTIC"
  | "NON_TECHNICAL";

export type FallbackLevel = "type" | "family" | "global";

export type SessionStatus = "ACTIVE" | "CLOSED";

export interface Candidate {
  cause_id: string;
  label: string;
  probability: number;
  n_supporting_cases: number;
  evidence_case_ids: string[];
  typical_parts: string[];
}

export interface Ranking {
  candidates: Candidate[];
  // The share reserved for a cause the taxonomy does not contain. Rendered, never hidden.
  other_probability: number;
  n_similar_cases: number;
  fallback_level: FallbackLevel;
  degraded: boolean;
}

export interface AnswerOption {
  value: string;
  label: string;
}

export interface Question {
  question_id: string;
  feature: string;
  prompt: string;
  options: AnswerOption[];
  expected_information_gain: number;
}

// How the backend worked out which machine this is. Null until it knows.
export type EquipmentBasis = "TYPE_CODE" | "FAMILY_NAME" | "COMPONENT" | "STATED";

export interface SessionView {
  session_id: string;
  status: SessionStatus;
  seq: number;
  taxonomy_version: string;
  // Null while the machine is unknown, which is every session that started with a
  // description naming neither a type code, the machine, nor a part only one family has.
  // The backend then asks which machine rather than ranking against the whole corpus.
  equipment_family: string | null;
  equipment_type: string | null;
  equipment_basis: EquipmentBasis | null;
  description: string;
  answers: Record<string, string>;
  ranking: Ranking;
  question: Question | null;
  confirmed_cause_id: string | null;
}

export interface CaseLabel {
  case_id: string;
  taxonomy_version: string;
  outcome_status: OutcomeStatus;
  cause_id: string | null;
  confidence: number;
  evidence_weight: number;
  flags: string[];
  evidence_spans: string[];
  // Computed server-side: failed validation, or confidence at or below the backend's
  // REVIEW_CONFIDENCE_THRESHOLD. On the wire so the frontend does not hold a second copy.
  needs_review: boolean;
}

export interface LabelRow {
  label: CaseLabel;
  equipment_family: string;
  equipment_type: string;
  // ISO 8601, UTC. When the case was closed, which is what the date-range filter cuts on.
  created_at: string;
  language: string;
  customer_description: string;
  technician_notes: string;
  resolution_text: string | null;
  parts_replaced: string[];
  cause_label: string | null;
}

export interface EvidenceCase {
  case_id: string;
  equipment_family: string;
  equipment_type: string;
  created_at: string;
  language: string;
  customer_description: string;
  technician_notes: string;
  parts_replaced: string[];
  resolution_text: string | null;
  // What the labeller made of it, and the spans it quoted to justify that.
  cause_id: string | null;
  cause_label: string | null;
  outcome_status: string;
  evidence_spans: string[];
}

export type EquipmentCatalogue = Record<string, string[]>;

// Events pushed over SSE. `seq` and `taxonomy_version` ride on every one: the first so a
// client that reconnected can tell whether it missed anything, the second so a client
// holding cause ids from an older taxonomy can notice rather than silently mis-render.
export type DiagnosisEventName =
  | "candidates.initial"
  | "candidates.updated"
  | "question"
  | "degraded"
  | "done"
  | "ping";

export interface DiagnosisEvent {
  event: DiagnosisEventName;
  seq: number;
  taxonomy_version: string;
  ranking?: Ranking;
  question?: Question;
  reason?: string;
  n_similar_cases?: number;
  fallback_level?: FallbackLevel;
  confirmed_cause_id?: string | null;
}
