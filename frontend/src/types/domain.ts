// Shim for the design system's src/types/domain.ts, which is its MongoDB-backed domain model.
// These three are the only types the copied components reach for, and all three are
// structural, so the shim is a faithful narrowing rather than a stand-in.
import type { BaseEntity } from "./common";

export interface IconFile {
  data?: string;
  src?: string;
  path?: string;
  [key: string]: unknown;
}

export interface File extends BaseEntity {
  name?: string;
  key?: string;
  alt?: string;
  preview?: string;
  src?: string;
  data?: string;
  author?: string;
  authorLink?: string;
  downloadLocation?: string;
}

export interface FileObject {
  name?: string;
  preview?: string;
  src?: string;
  key?: string;
  file?: globalThis.File;
  data?: string;
  [key: string]: unknown;
}
