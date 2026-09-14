// Origin: the in-house design system, src/helpers/formatting/formatDate.ts. Copied to keep this app native to the design system.
// Copied with no changes.
type DateLike = Date | string | number;

const LOCALE_ALIASES: Record<string, string> = { en: "en-GB", "": "en-GB" };

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
};

const DATE_LONG_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
};

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
};

const formatters = new Map<string, Intl.DateTimeFormat>();

const FALLBACK_LOCALE = "en-GB";

const formatter = (
  key: string,
  options: Intl.DateTimeFormatOptions,
  lang?: string,
): Intl.DateTimeFormat => {
  const locale = LOCALE_ALIASES[lang ?? ""] ?? lang ?? FALLBACK_LOCALE;
  const id = `${key}:${locale}`;
  const cached = formatters.get(id);
  if (cached) return cached;
  let made: Intl.DateTimeFormat;
  try {
    made = new Intl.DateTimeFormat(locale, options);
  } catch {
    made = new Intl.DateTimeFormat(FALLBACK_LOCALE, options);
  }
  formatters.set(id, made);
  return made;
};

const toDate = (value: DateLike): Date | null => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value: DateLike, lang?: string): string => {
  const date = toDate(value);
  return date ? formatter("date", DATE_OPTIONS, lang).format(date) : "";
};

export const formatDateLong = (value: DateLike, lang?: string): string => {
  const date = toDate(value);
  return date ? formatter("dateLong", DATE_LONG_OPTIONS, lang).format(date) : "";
};

const formatTime = (value: DateLike, lang?: string): string => {
  const date = toDate(value);
  return date ? formatter("time", TIME_OPTIONS, lang).format(date) : "";
};

export const formatDateTime = (value: DateLike, lang?: string): string => {
  const date = toDate(value);
  return date ? `${formatDate(date, lang)}, ${formatTime(date, lang)}` : "";
};

export const formatTimeDate = (value: DateLike, lang?: string): string => {
  const date = toDate(value);
  return date ? `${formatTime(date, lang)} / ${formatDate(date, lang)}` : "";
};
