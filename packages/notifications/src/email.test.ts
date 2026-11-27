import { afterEach, expect, it, vi } from "vitest";
import { createEmailSender } from "./email.ts";

afterEach(() => vi.unstubAllGlobals());

it("requires an API key for Resend", () => {
  expect(() =>
    createEmailSender({ EMAIL_TRANSPORT: "resend", SMTP_URL: "smtp://x:1" } as never),
  ).toThrow(/RESEND_API_KEY/);
});

it("posts to Resend with the sender address", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const send = createEmailSender({
    EMAIL_TRANSPORT: "resend",
    SMTP_URL: "smtp://x:1",
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "BAS <a@b.lt>",
  });
  await send({ to: "c@d.lt", subject: "Hi", text: "Body" });
  const [, init] = fetchMock.mock.calls[0]!;
  expect(JSON.parse(init.body)).toEqual({
    from: "BAS <a@b.lt>",
    to: "c@d.lt",
    subject: "Hi",
    text: "Body",
  });
  expect(init.headers.Authorization).toBe("Bearer re_test");
});

it("surfaces Resend errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad", { status: 422 })));
  const send = createEmailSender({
    EMAIL_TRANSPORT: "resend",
    SMTP_URL: "smtp://x:1",
    RESEND_API_KEY: "k",
  });
  await expect(send({ to: "a@b.lt", subject: "s", text: "t" })).rejects.toThrow(/422/);
});
