"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function StaffSignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded border border-white/30 px-3 py-1 text-sm hover:bg-white/10"
      onClick={async () => {
        await authClient.signOut();
        router.push("/admin/sign-in");
      }}
    >
      Sign out
    </button>
  );
}
