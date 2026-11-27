import { notFound, redirect } from "next/navigation";
import { TwoFactorSetup } from "@/components/admin/TwoFactorSetup";
import { staffAccess } from "@/server/access";
import { getSession } from "@/server/session";

export default async function TwoFactorSetupPage() {
  const access = staffAccess((await getSession())?.user);
  if (access === "sign-in") redirect("/admin/sign-in");
  if (access === "forbidden") notFound();
  if (access === "allow") redirect("/admin"); // already set up
  return (
    <main className="px-4 py-16">
      <TwoFactorSetup />
    </main>
  );
}
