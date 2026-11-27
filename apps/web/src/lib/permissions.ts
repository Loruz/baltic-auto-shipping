/**
 * Roles (plan §5). Shared by the server (admin plugin) and the browser client.
 * customer: the default for every sign-up. operator: broker staff who place bids. admin: the broker
 * owner and the developer. Console permissions for operators arrive with the console in M7.
 */
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

export const ac = createAccessControl(defaultStatements);

export const roles = {
  customer: ac.newRole({ user: [], session: [] }),
  operator: ac.newRole({ user: [], session: [] }),
  admin: ac.newRole(adminAc.statements),
};

export type Role = keyof typeof roles;
export const STAFF_ROLES = ["operator", "admin"] as const satisfies readonly Role[];

export function isStaffRole(role: string | null | undefined): boolean {
  return (STAFF_ROLES as readonly string[]).includes(role ?? "");
}
