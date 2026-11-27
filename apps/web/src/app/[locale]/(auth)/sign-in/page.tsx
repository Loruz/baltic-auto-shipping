import { AuthCard } from "@/components/auth/ui";
import { SignInForm } from "@/components/auth/SignInForm";
import { resolveLocale } from "@/lib/locale";
import { safeNextPath } from "@/server/access";
import { getEnv } from "@/server/env";

export default async function SignInPage({ params, searchParams }: PageProps<"/[locale]/sign-in">) {
  const { locale, t } = await resolveLocale(params);
  const { next } = await searchParams;
  const env = getEnv();
  return (
    <AuthCard title={t.auth.signIn}>
      <SignInForm
        locale={locale}
        next={safeNextPath(typeof next === "string" ? next : null, `/${locale}/account`)}
        googleEnabled={Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)}
        t={t.auth}
      />
    </AuthCard>
  );
}
