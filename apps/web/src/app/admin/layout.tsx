import type { Metadata } from "next";
import { montserrat, plexSans } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "Admin · Baltic Auto Shipping",
  robots: { index: false },
};

// Operator console (plan §5). The (console) group is guarded; (auth) holds sign-in and 2FA.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="lt" className={`${montserrat.variable} ${plexSans.variable}`}>
      <body className="bg-slate-50 font-sans antialiased">{children}</body>
    </html>
  );
}
