import { AccountActions } from "@/components/auth/AccountActions";
import { resolveLocale } from "@/lib/locale";
import { requireUser } from "@/server/session";

// M8 adds bids, plan, buying power, favourites, saved searches and the refund request.
export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  const { locale, t } = await resolveLocale(params);
  const { user } = await requireUser(locale, `/${locale}/account`);
  return (
    <section className="space-y-4">
      <h1 className="font-heading text-2xl font-bold">{t.auth.accountTitle}</h1>
      <dl className="text-sm">
        <dt className="font-medium">{t.auth.email}</dt>
        <dd>
          {user.email}{" "}
          <span className={user.emailVerified ? "text-green-700" : "text-amber-700"}>
            ({user.emailVerified ? t.auth.emailVerified : t.auth.emailNotVerified})
          </span>
        </dd>
      </dl>
      <AccountActions
        locale={locale}
        email={user.email}
        emailVerified={user.emailVerified}
        t={t.auth}
      />
    </section>
  );
}
