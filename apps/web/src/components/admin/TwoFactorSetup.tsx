"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import QRCode from "react-qr-code";
import { AuthCard, Field, FormMessage, SubmitButton } from "@/components/auth/ui";
import { authClient } from "@/lib/auth-client";

type Enrolment = { totpURI: string; backupCodes: string[] };

/**
 * Required for staff (plan §5): confirm the password, scan the QR code, store the backup codes,
 * then confirm with a first code. 2FA is active only after that confirmation.
 */
export function TwoFactorSetup() {
  const router = useRouter();
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password"));
    setPending(true);
    setError(null);
    const { data, error } = await authClient.twoFactor.enable({ password });
    setPending(false);
    if (error || !data || !("totpURI" in data)) return setError("Wrong password.");
    setEnrolment({ totpURI: data.totpURI, backupCodes: data.backupCodes });
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code")).trim();
    setPending(true);
    setError(null);
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (error)
      return setError("That code didn't work. Check the time on your phone and try again.");
    router.push("/admin");
    router.refresh();
  }

  if (!enrolment) {
    return (
      <AuthCard title="Set up two-factor sign-in">
        <p className="mb-4 text-sm text-slate-600">
          Staff accounts need an authenticator app (Google Authenticator, 1Password, Authy…).
          Confirm your password to start.
        </p>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <form onSubmit={start}>
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <SubmitButton pending={pending}>Continue</SubmitButton>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Scan and confirm">
      <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm">
        <li>Scan this code with your authenticator app.</li>
        <li>Save the backup codes somewhere safe. Each works once if you lose your phone.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <div className="mb-4 flex justify-center bg-white p-3">
        <QRCode value={enrolment.totpURI} size={180} />
      </div>
      <ul className="mb-4 grid grid-cols-2 gap-1 rounded bg-slate-100 p-3 font-mono text-sm">
        {enrolment.backupCodes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <form onSubmit={confirm}>
        <Field
          label="6-digit code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
        />
        <SubmitButton pending={pending}>Turn on two-factor sign-in</SubmitButton>
      </form>
    </AuthCard>
  );
}
