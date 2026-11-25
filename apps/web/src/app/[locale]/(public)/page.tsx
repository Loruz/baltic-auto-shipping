import { isLocale, messages } from "@bas/i18n";
import { notFound } from "next/navigation";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <h1 className="font-heading text-3xl font-bold text-brand">{messages[locale].site.tagline}</h1>
  );
}
