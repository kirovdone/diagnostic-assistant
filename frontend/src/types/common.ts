// Origin: the in-house design system, src/types/common.ts. Copied to keep this app native to the design system.
// Copied with no changes.
import type { CSSProperties, Dispatch, SetStateAction } from "react";

export type Setter<T> = Dispatch<SetStateAction<T>>;

export type ThemeMode = "light" | "dark";
export type NotificationType = "success" | "error" | "aborted";

export interface BaseEntity {
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export type FrameType = "solid" | "outline" | "transparent" | "none";
export type ButtonSize = "xsmall" | "small" | "normal" | "large";
export type SiteButtonSize = Exclude<ButtonSize, "xsmall">;
export interface StylesReturn {
  className: string;
  style: CSSProperties;
  align?: {
    flex: CSSProperties;
    grid: CSSProperties;
  };
  isRow?: boolean;
}

export type LayoutType = "grid" | "masonry" | "flex";
type LayoutDirection = "vertical" | "horizontal";

type MdOrder = "first" | "last";

export interface LayoutChild {
  _id: string;
  type: "layout" | "element" | string;
  children?: LayoutChild[];
  colSpan?: number;
  mdOrder?: MdOrder;
  [key: string]: unknown;
}

export interface LayoutConfig {
  _id?: string;
  type?: string;
  layout?: string;
  columns?: number;
  gap?: string | number;
  spacing?: string | number;
  width?: string | number;
  justifyContent?: "start" | "center" | "end";
  direction?: LayoutDirection;
  children?: LayoutChild[];
  colSpan?: number;
  mdOrder?: MdOrder;
  [key: string]: unknown;
}

export type ColorValue = string | Record<string, unknown>;

interface FabricCoords {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  r1?: number;
  r2?: number;
}

interface FabricGradientStop {
  offset: number;
  color: string;
}

export interface FabricGradientDescriptor {
  type?: "linear" | "radial";
  coords?: FabricCoords;
  colorStops?: FabricGradientStop[];
}

export type CssColorInput =
  | string
  | FabricGradientDescriptor
  | RawColorData
  | null
  | undefined;

interface RawColorStop {
  value: string;
  left: number;
}

export interface RawColorData {
  type?: "linear" | "radial";
  coords?: FabricCoords;
  colorStops?: FabricGradientStop[];
  color?: string;
  isGradient?: boolean;
  colors?: RawColorStop[];
  gradientType?: string;
  degrees?: string;
}

type GradientCoords = Partial<FabricCoords>;

interface GradientDefinition {
  type: "linear" | "radial" | string;
  coords: GradientCoords;
  colorStops: FabricGradientStop[];
  gradientUnits?: string;
  gradientTransform?: string;
}

export type ColorVariation = string | GradientDefinition;

export type Translate = (
  key: string,
  params?: Record<string, unknown>,
) => string;
