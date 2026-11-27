/**
 * Email transport (plan §3: Resend in production, SMTP to Mailpit locally; §6 EMAIL_TRANSPORT).
 * Used directly for auth emails (verify address, reset password). Business notifications go through
 * the outbox from M6 and will use the same sender.
 */
import type { ServerEnv } from "@bas/config/env";
import nodemailer from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export type SendEmail = (message: EmailMessage) => Promise<void>;

type EmailEnv = Pick<ServerEnv, "EMAIL_TRANSPORT" | "SMTP_URL" | "RESEND_API_KEY" | "EMAIL_FROM">;

const DEFAULT_FROM = "Baltic Auto Shipping <no-reply@localhost>";

export function createEmailSender(env: EmailEnv): SendEmail {
  const from = env.EMAIL_FROM ?? DEFAULT_FROM;

  if (env.EMAIL_TRANSPORT === "smtp") {
    const transport = nodemailer.createTransport(env.SMTP_URL);
    return async (message) => {
      await transport.sendMail({ from, ...message });
    };
  }

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new Error("EMAIL_TRANSPORT=resend needs RESEND_API_KEY");
  return async (message) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, ...message }),
    });
    if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
  };
}
