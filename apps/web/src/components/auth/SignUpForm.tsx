"use client";

import type { Messages } from "@bas/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Field, FormMessage, SubmitButton } from "./ui";

export function SignUpForm({ locale, t }: { locale: string; t: Messages["auth"] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
      // Where the link in the confirmation email lands.
      callbackURL: `/${locale}/account`,
    });
    setPending(false);
    if (error) return setError(error.message ?? t.genericError);
    router.push(`/${locale}/account`);
    router.refresh();
  }

  return (
    <>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <form onSubmit={onSubmit}>
        <Field label={t.name} name="name" autoComplete="name" required />
        <Field label={t.email} name="email" type="email" autoComplete="email" required />
        <Field
          label={t.password}
          hint={t.passwordHint}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
        <SubmitButton pending={pending}>{t.signUp}</SubmitButton>
      </form>
      <p className="mt-6 text-sm">
        {t.haveAccount}{" "}
        <Link href={`/${locale}/sign-in`} className="text-sky-text underline">
          {t.signIn}
        </Link>
      </p>
    </>
  );
}
