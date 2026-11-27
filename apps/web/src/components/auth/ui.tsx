// Minimal form building blocks for the auth screens. Replaced by shadcn/ui with the first real UI work.
import type { InputHTMLAttributes, ReactNode } from "react";

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-sm rounded-lg border border-slate-200 p-6 shadow-sm">
      <h1 className="mb-6 font-heading text-2xl font-bold text-brand">{title}</h1>
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="mb-4 block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        className="w-full rounded border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none"
        {...input}
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-brand px-4 py-2 font-medium text-white hover:bg-brand-deep disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`mb-4 rounded px-3 py-2 text-sm ${tone === "error" ? "bg-red-50 text-red-800" : "bg-sky-50 text-sky-text"}`}
    >
      {children}
    </p>
  );
}
