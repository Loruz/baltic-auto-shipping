import { AuthCard } from "@/components/auth/ui";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { resolveLocale } from "@/lib/locale";

export default async function SignUpPage({ params }: PageProps<"/[locale]/sign-up">) {
  const { locale, t } = await resolveLocale(params);
  return (
    <AuthCard title={t.auth.signUp}>
      <SignUpForm locale={locale} t={t.auth} />
    </AuthCard>
  );
}
