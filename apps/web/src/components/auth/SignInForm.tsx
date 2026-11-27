"use client";

import type { Messages } from "@bas/i18n";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Field, FormMessage, SubmitButton } from "./ui";

interface Props {
  locale: string;
  next: string;
  googleEnabled: boolean;
  t: Messages["auth"];
}

export function SignInForm({ locale, next, googleEnabled, t }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(false);
    const { data, error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    // Staff with 2FA (plan §5) finish signing in on the admin 2FA screen.
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      return router.push("/admin/two-factor");
    }
    setPending(false);
    if (error) return setError(true);
    router.push(next as Route);
    router.refresh();
  }

  return (
    <>
      {error && <FormMessage tone="error">{t.genericError}</FormMessage>}
      <form onSubmit={onSubmit}>
        <Field label={t.email} name="email" type="email" autoComplete="email" required />
        <Field
          label={t.password}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <SubmitButton pending={pending}>{t.signIn}</SubmitButton>
      </form>
      {googleEnabled && (
        <button
          type="button"
          onClick={() => authClient.signIn.social({ provider: "google", callbackURL: next })}
          className="mt-3 w-full rounded border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50"
        >
          {t.continueWithGoogle}
        </button>
      )}
      <div className="mt-6 space-y-1 text-sm">
        <p>
          <Link href={`/${locale}/forgot-password`} className="text-sky-text underline">
            {t.forgotPassword}
          </Link>
        </p>
        <p>
          {t.noAccount}{" "}
          <Link href={`/${locale}/sign-up`} className="text-sky-text underline">
            {t.signUp}
          </Link>
        </p>
      </div>
    </>
  );
}
