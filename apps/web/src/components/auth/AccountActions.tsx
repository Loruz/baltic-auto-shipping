"use client";

import type { Messages } from "@bas/i18n";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { FormMessage } from "./ui";

interface Props {
  locale: string;
  email: string;
  emailVerified: boolean;
  t: Messages["auth"];
}

export function AccountActions({ locale, email, emailVerified, t }: Props) {
  const router = useRouter();
  const [sent, setSent] = useState(false);

  async function resend() {
    await authClient.sendVerificationEmail({ email, callbackURL: `/${locale}/account` });
    setSent(true);
  }

  async function signOut() {
    await authClient.signOut();
    router.push(`/${locale}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!emailVerified &&
        (sent ? (
          <FormMessage tone="info">{t.verificationSent}</FormMessage>
        ) : (
          <button type="button" onClick={resend} className="text-sm text-sky-text underline">
            {t.resendVerification}
          </button>
        ))}
      <div>
        <button
          type="button"
          onClick={signOut}
          className="rounded border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          {t.signOut}
        </button>
      </div>
    </div>
  );
}
