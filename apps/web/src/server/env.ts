import "server-only";
import { parseServerEnv, type ServerEnv } from "@bas/config/env";

let cached: ServerEnv | undefined;

/**
 * Parsed on first use, not at import: `next build` imports route modules without the runtime
 * environment (images get it only when they start). Import only from server code.
 */
export function getEnv(): ServerEnv {
  cached ??= parseServerEnv();
  return cached;
}
