"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthCard, Field, FormMessage, SubmitButton } from "@/components/auth/ui";
import { authClient } from "@/lib/auth-client";

/** Second step of staff sign-in: a code from the authenticator app, or a backup code. */
export function TwoFactorVerifyForm() {
  const router = useRouter();
  const [useBackup, setUseBackup] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code")).trim();
    setPending(true);
    setError(false);
    const { error } = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code })
      : await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (error) return setError(true);
    router.push("/admin");
    router.refresh();
  }

  return (
    <AuthCard title="Two-factor check">
      {error && <FormMessage tone="error">That code didn&apos;t work. Try again.</FormMessage>}
      <form onSubmit={onSubmit}>
        <Field
          label={useBackup ? "Backup code" : "6-digit code from your authenticator app"}
          name="code"
          autoComplete="one-time-code"
          inputMode={useBackup ? "text" : "numeric"}
          required
          autoFocus
        />
        <SubmitButton pending={pending}>Verify</SubmitButton>
      </form>
      <button
        type="button"
        onClick={() => setUseBackup((v) => !v)}
        className="mt-4 text-sm text-sky-text underline"
      >
        {useBackup ? "Use the authenticator app" : "Use a backup code"}
      </button>
    </AuthCard>
  );
}
