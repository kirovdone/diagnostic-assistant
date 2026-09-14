// Origin: the in-house design system, src/types/components.ts. Copied to keep this app native to the design system.
// Copied with no changes.
import type { RichText } from "@/types/rendering";
import type {
  ChangeEventHandler,
  FocusEventHandler,
  CSSProperties,
  HTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent,
  KeyboardEventHandler,
  ReactNode,
  UIEventHandler,
} from "react";
import type { Filters } from "./api";
import type { ColorValue } from "./common";
import type { IconFile } from "./domain";

import type { ButtonSize } from "./common";
import type { ButtonHTMLAttributes, MouseEvent } from "react";

export type ButtonVariant =
  "solid" | "accent" | "outline" | "transparent" | "none" | "danger";

export interface ButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "translate" | "content" | "onClick"
> {
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  link?: string;
  linkType?: "external" | "section" | "page" | "email" | "phone";
  prefetch?: boolean;
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
  color?: string;
  items?: ButtonProps[];
  actions?: ButtonProps[];
  itemsType?: "dropdown" | "accordion";
  content?: ReactNode;
  contentHeader?: ReactNode;
  contentFooter?: ReactNode;
  tooltipLabel?: string;
  rel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onContentInteractOutside?: (event: Event) => void;
  justifyContent?: "start" | "center" | "end";
  onContentScroll?: UIEventHandler<HTMLDivElement>;
  itemsLoading?: boolean;
  justifyItems?: "start" | "center" | "end";
  label?: string;
}

export type BadgeTone =
  "success" | "destructive" | "warning" | "neutral" | "featured";

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: BadgeTone;
  label?: string;
}

export type InputSize = "small" | "normal" | "large";

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>,
  "value" | "size"
> {
  value?: string | Date;
  disabled?: boolean;
  block?: boolean;
  size?: InputSize;
  prependPrefix?: string;
  icon?: ReactNode;
  required?: boolean;
  label?: string;
  maxLength?: number;
  rows?: number;
  min?: number;
  max?: number;
  buttons?: ReactNode;
  labelButton?: ReactNode;
  options?: string[];
  optionsLoading?: boolean;
  onOptionSelect?: (option: string) => void;
}

export interface TextareaProps {
  className?: string;
  disabled?: boolean;
  value?: string;
  placeholder?: string;
  maxLength?: number;
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
  onBlur?: FocusEventHandler<HTMLTextAreaElement>;
  rows?: number;
  autoFocus?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
}

interface SwatchGroup {
  label: string;
  colors: string[];
}

export interface ColorPickerProps {
  label?: string;
  disabled?: boolean;
  value?: string;
  onChange?: (val: ColorValue) => void;
  customColors?: string[];
  setCustomColors?: (colors: string[]) => void;
  swatches?: SwatchGroup[];
  required?: boolean;
  id?: string;
  size?: "small" | "normal";
  type?: "input" | "button";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export interface DropzoneProps {
  label?: string;
  size?: "small" | "normal";
  fileLimit?: number;
  fileTypes?: string | string[];
  images?: import("./domain").File[];
  onChange?: (
    value: import("./domain").File | import("./domain").File[],
  ) => void;
  handleFileInput?: (files: import("./domain").FileObject[]) => void;
  handleFileDelete?: (
    files: import("./domain").File[],
    file: import("./domain").File,
    index: number,
  ) => void;
  query?: string;
  required?: boolean;
  type?: "default" | "multiple";
  fileType?: "photos" | "icons";
  imagesModal?: boolean;
  toggleImagesModal?: () => void;
  fill?: boolean;
}

export interface IconProps {
  file?: IconFile | IconFile[];
  width?: number | string;
  height?: number | string;
  color?: string;
  strokeWidth?: number | string;
  className?: string;
  lazyLoad?: boolean;
  backgroundColor?: string;
  borderRadius?: number | string;
  padding?: number | string;
  size?: number | string;
  fill?: boolean;
  unoptimized?: boolean;
  style?: CSSProperties;
}

export interface TextProps {
  content?: string | unknown;
  tag?: string;
  width?: number | string;
  className?: string;
  editable?: boolean;
  onContentChange?: (content: RichText) => void;
  onEditingChange?: (editing: boolean) => void;
  onKeyDownExtra?: (e: KeyboardEvent) => void;
  style?: CSSProperties;
  fontSize?: string | number;
  lineHeight?: string | number;
  [key: string]: unknown;
}

export interface RatingProps {
  count: number;
}

type NotFoundType = "image" | "icon" | "text";

export interface NotFoundProps {
  type?: NotFoundType;
  className?: string;
  icon?: ReactNode;
  title?: string;
  subtitle?: string;
}

type LoaderType = "website" | "logo" | "document" | "ad";

export interface LoaderProps {
  width?: string | number;
  height?: string | number;
  cols?: number | string;
  count?: number;
  gap?: number;
  className?: string;
  color?: string;
  type?: LoaderType;
  label?: string;
  detail?: string;
}

export interface ModalProps {
  title: ReactNode;
  className?: string;
  overlayClassName?: string;
  hideHeader?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  content?: ReactNode;
  footer?: ReactNode;
  buttonText?: string;
  danger?: boolean;
}

export interface MetaProps {
  title?: string;
  description?: string;
}

export interface ScriptsProps {
  items: string[];
}

type CalloutAction = {
  label: string;
  onClick?: () => void;
  link?: string;
  loading?: boolean;
};

export interface CalloutProps extends HTMLAttributes<HTMLDivElement> {
  variant?: BadgeTone;
  message: string | ReactNode;
  actions?: CalloutAction[];
}

type LabelAction = {
  icon?: ReactNode;
  onClick?: () => void;
  link?: string;
  loading?: boolean;
  className?: string;
  variant?: ButtonVariant;
  items?: { label: string; onClick: () => void }[];
};

export interface LabelProps {
  id?: string;
  label?: ReactNode;
  size?: "small" | "normal";
  icon?: ReactNode;
  required?: boolean;
  className?: string;
  actions?: LabelAction[];
  meta?: ReactNode;
}

export type ContentWidth = "default" | "wide";

export interface Breadcrumb {
  label: string;
  icon?: ReactNode;
  link?: string;
  items?: ButtonProps[];
  onClick?: () => void;
  onOpenChange?: (open: boolean) => void;
  onContentScroll?: UIEventHandler<HTMLDivElement>;
  onSearchChange?: (query: string) => void;
  itemsLoading?: boolean;
  contentFooter?: ReactNode;
  placeholder?: boolean;
  loading?: boolean;
}

export interface NavigationItem extends ButtonProps {
  isDropdown?: boolean;
  items?: NavigationItem[];
  image?: { src?: string } | null;
}

export interface NavigationProps {
  children?: ReactNode;
  accountLinks?: NavigationItem[];
  accountLinksLoading?: boolean;
  hasSidebar?: boolean;
  userMenu?: NavigationItem;
  userMenuLoading?: boolean;
  notifications?: NavigationItem;
  navActions?: ReactNode;
  breadcrumbs?: Breadcrumb[];
  breadcrumbsLoading?: boolean;
  onBillingClick?: () => void;
  onChatClick?: () => void;
  onSettingsClick?: () => void;
  sidebarTakeover?: ReactNode;
  contentFullBleed?: boolean;
}

export interface ActionOption {
  label: string;
  value: string | Record<string, unknown>;
  [key: string]: unknown;
}

export interface SelectorProps {
  name: string;
  property: string;
  action: Record<string, unknown>;
  actions: readonly ActionOption[];
  setShowSelectors: (open: boolean) => void;
  handleActionChange: (property: string, value: ActionOption["value"]) => void;
  onActionHandler: (setLoading: (v: boolean) => void) => Promise<void>;
  forceToggle?: boolean;
}

export type FilterVariant = "query" | "status" | "dateRange";

export interface FilterOption {
  _id: string;
  name: string;
}

interface MultiFilter {
  key: string;
  label: string;
  items: readonly FilterOption[];
  onScrollToBottom?: () => void;
  onSearch?: (query: string) => void;
  loading?: boolean;
}

export interface ActiveFiltersProps {
  filters?: Record<string, unknown> | null;
  multiFilters?: readonly MultiFilter[];
  setLoading?: (loading: boolean) => void;
  className?: string;
}

export interface FilterProps {
  filters?: Filters;
  setLoading?: (loading: boolean) => void;
  multiFilters?: readonly MultiFilter[];
  query?: string;
  setQuery?: (query: string) => void;
  statuses?: readonly string[];
  variant?: readonly FilterVariant[];
}

export interface UnsplashItem {
  id: string;
  urls: { regular: string; small?: string; thumb?: string };
  alt_description?: string;
  description?: string;
  user?: { name?: string; links?: { html?: string } };
  links?: { download_location?: string };
}

export interface UnsplashData {
  total: number;
  results: UnsplashItem[];
}

export interface FilesModalProps {
  isOpen: boolean;
  toggleModal: (open?: boolean) => void;
  onChange?: (
    files: import("./domain").File | import("./domain").File[],
  ) => void;
  images: import("./domain").File[];
  query?: string;
  fileLimit: number;
  type: "photos" | "icons";
}

export type ThemePreference = "system" | "light" | "dark";

export interface ContextProps {
  loading?: boolean;
  setLoading?: (loading: boolean) => void;
  authLoading?: boolean;
  setAuthLoading?: (authLoading: boolean) => void;
  theme: "light" | "dark";
  themePreference?: ThemePreference;
  setThemeMode?: (mode: ThemePreference) => void;
}

export interface OverrideLanguageProps {
  children: ReactNode;
  language?: string;
  namespace?: string;
}
