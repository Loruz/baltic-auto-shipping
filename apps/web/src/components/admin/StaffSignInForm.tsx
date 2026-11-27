"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthCard, Field, FormMessage, SubmitButton } from "@/components/auth/ui";
import { authClient } from "@/lib/auth-client";

export function StaffSignInForm() {
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
    // The console guard sends staff without 2FA to setup, and customers to a 404.
    router.push("/admin");
    router.refresh();
  }

  return (
    <AuthCard title="Staff sign in">
      {error && <FormMessage tone="error">Wrong email or password.</FormMessage>}
      <form onSubmit={onSubmit}>
        <Field label="Email" name="email" type="email" autoComplete="username" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </form>
    </AuthCard>
  );
}
