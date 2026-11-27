"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";

/** Client-side, so public pages stay statically rendered. */
export function HeaderAccountLink({
  locale,
  labels,
}: {
  locale: string;
  labels: { account: string; signIn: string };
}) {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <span className="ml-auto" />;
  return session ? (
    <Link href={`/${locale}/account`} className="ml-auto">
      {labels.account}
    </Link>
  ) : (
    <Link href={`/${locale}/sign-in`} className="ml-auto">
      {labels.signIn}
    </Link>
  );
}
