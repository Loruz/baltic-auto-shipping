import { AuthCard } from "@/components/auth/ui";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { resolveLocale } from "@/lib/locale";

export default async function ForgotPasswordPage({
  params,
}: PageProps<"/[locale]/forgot-password">) {
  const { locale, t } = await resolveLocale(params);
  return (
    <AuthCard title={t.auth.forgotTitle}>
      <ForgotPasswordForm locale={locale} t={t.auth} />
    </AuthCard>
  );
}
