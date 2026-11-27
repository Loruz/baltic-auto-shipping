import { StaffSignOut } from "@/components/admin/StaffSignOut";
import { requireStaff } from "@/server/session";

// Every console page sits behind this guard: staff role + TOTP 2FA (plan §5).
export default async function ConsoleLayout({ children }: LayoutProps<"/admin">) {
  const { user } = await requireStaff();
  return (
    <>
      <header className="flex items-center gap-4 bg-night px-4 py-3 text-white">
        <span className="font-heading font-bold">Admin</span>
        <span className="ml-auto text-sm text-slate-300">
          {user.email} · {user.role}
        </span>
        <StaffSignOut />
      </header>
      <main className="p-4">{children}</main>
    </>
  );
}
