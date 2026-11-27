import { AuthCard } from "@/components/auth/ui";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { resolveLocale } from "@/lib/locale";

// Better Auth sends the user here with ?token=… (or ?error=INVALID_TOKEN).
export default async function ResetPasswordPage({
  params,
  searchParams,
}: PageProps<"/[locale]/reset-password">) {
  const { locale, t } = await resolveLocale(params);
  const { token } = await searchParams;
  return (
    <AuthCard title={t.auth.resetTitle}>
      <ResetPasswordForm
        locale={locale}
        token={typeof token === "string" ? token : null}
        t={t.auth}
      />
    </AuthCard>
  );
}
