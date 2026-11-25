import type { Metadata } from "next";
import { montserrat, plexSans } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "Admin · Baltic Auto Shipping",
  robots: { index: false },
};

// Operator console (plan §5). Staff-only behind Better Auth roles + TOTP from M1.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="lt" className={`${montserrat.variable} ${plexSans.variable}`}>
      <body className="bg-slate-50 font-sans antialiased">
        <header className="bg-night px-4 py-3 font-heading font-bold text-white">Admin</header>
        <main className="p-4">{children}</main>
      </body>
    </html>
  );
}
