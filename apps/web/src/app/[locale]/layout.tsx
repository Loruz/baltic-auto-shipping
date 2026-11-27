import { LOCALES, isLocale, messages } from "@bas/i18n";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HeaderAccountLink } from "@/components/auth/HeaderAccountLink";
import { montserrat, plexSans } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: { default: messages[locale].site.name, template: `%s · ${messages[locale].site.name}` },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = messages[locale];

  return (
    <html lang={locale} className={`${montserrat.variable} ${plexSans.variable}`}>
      <body className="font-sans antialiased">
        <header className="bg-brand text-white">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href={`/${locale}`} className="font-heading font-bold">
              {t.site.name}
            </Link>
            <Link href={`/${locale}/search`}>{t.nav.search}</Link>
            <HeaderAccountLink
              locale={locale}
              labels={{ account: t.nav.account, signIn: t.nav.signIn }}
            />
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
