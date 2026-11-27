"use client";

import type { Messages } from "@bas/i18n";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Field, FormMessage, SubmitButton } from "./ui";

interface Props {
  locale: string;
  token: string | null;
  t: Messages["auth"];
}

export function ResetPasswordForm({ locale, token, t }: Props) {
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<"form" | "done" | "invalid">(token ? "form" : "invalid");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    const { error } = await authClient.resetPassword({
      token,
      newPassword: String(form.get("password")),
    });
    setPending(false);
    setState(error ? "invalid" : "done");
  }

  if (state !== "form") {
    return (
      <>
        <FormMessage tone={state === "done" ? "info" : "error"}>
          {state === "done" ? t.resetDone : t.resetInvalid}
        </FormMessage>
        <Link
          href={state === "done" ? `/${locale}/sign-in` : `/${locale}/forgot-password`}
          className="text-sky-text underline"
        >
          {state === "done" ? t.signIn : t.forgotTitle}
        </Link>
      </>
    );
  }
  return (
    <form onSubmit={onSubmit}>
      <Field
        label={t.newPassword}
        hint={t.passwordHint}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        required
      />
      <SubmitButton pending={pending}>{t.resetSubmit}</SubmitButton>
    </form>
  );
}
