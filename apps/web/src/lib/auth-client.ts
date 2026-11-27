import { adminClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, roles } from "./permissions";

/** Browser auth client. Same origin as the app, so no baseURL is needed. */
export const authClient = createAuthClient({
  plugins: [
    adminClient({ ac, roles }),
    // Sign-in forms check `twoFactorRedirect` and route to /admin/two-factor themselves.
    twoFactorClient(),
  ],
});
