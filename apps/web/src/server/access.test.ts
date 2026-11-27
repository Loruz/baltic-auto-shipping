import { describe, expect, it } from "vitest";
import { safeNextPath, staffAccess } from "./access";

describe("staffAccess", () => {
  it.each([
    [null, "sign-in"],
    [{ role: "customer", twoFactorEnabled: true }, "forbidden"],
    [{ role: null }, "forbidden"],
    [{ role: "operator", twoFactorEnabled: false }, "setup-2fa"],
    [{ role: "admin", twoFactorEnabled: null }, "setup-2fa"],
    [{ role: "operator", twoFactorEnabled: true }, "allow"],
    [{ role: "admin", twoFactorEnabled: true }, "allow"],
  ] as const)("%j → %s", (user, expected) => {
    expect(staffAccess(user)).toBe(expected);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/lt/account", "/lt/account"],
    [null, "/fallback"],
    ["https://evil.example", "/fallback"],
    ["//evil.example", "/fallback"],
    ["/\\evil.example", "/fallback"],
  ])("%s → %s", (next, expected) => {
    expect(safeNextPath(next, "/fallback")).toBe(expected);
  });
});
