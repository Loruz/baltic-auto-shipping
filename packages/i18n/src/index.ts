import en from "../messages/en.json" with { type: "json" };
import lt from "../messages/lt.json" with { type: "json" };

export const LOCALES = ["lt", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "lt";

export type Messages = typeof lt;
export const messages: Record<Locale, Messages> = { lt, en };

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
