import { TwoFactorVerifyForm } from "@/components/admin/TwoFactorVerifyForm";

// Reached from sign-in when the account has 2FA; Better Auth holds the pending sign-in in a cookie.
export default function TwoFactorPage() {
  return (
    <main className="px-4 py-16">
      <TwoFactorVerifyForm />
    </main>
  );
}
