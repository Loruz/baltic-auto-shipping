"use client";

import type { Messages } from "@bas/i18n";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Field, FormMessage, SubmitButton } from "./ui";

export function ForgotPasswordForm({ locale, t }: { locale: string; t: Messages["auth"] }) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    await authClient.requestPasswordReset({
      email: String(form.get("email")),
      redirectTo: `/${locale}/reset-password`,
    });
    // Same message whether or not the address exists (no account enumeration).
    setPending(false);
    setSent(true);
  }

  if (sent) return <FormMessage tone="info">{t.resetLinkSent}</FormMessage>;
  return (
    <form onSubmit={onSubmit}>
      <Field label={t.email} name="email" type="email" autoComplete="email" required />
      <SubmitButton pending={pending}>{t.sendResetLink}</SubmitButton>
    </form>
  );
}
