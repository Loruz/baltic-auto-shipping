import { isLocale, messages, type Locale, type Messages } from "@bas/i18n";
import { notFound } from "next/navigation";

/** Validates the [locale] segment and returns its messages; unknown locales are a 404. */
export async function resolveLocale(
  params: Promise<{ locale: string }>,
): Promise<{ locale: Locale; t: Messages }> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { locale, t: messages[locale] };
}
