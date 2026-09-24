// The password check for the admin page: HTTP Basic auth, run by src/proxy.ts
// before /admin is rendered. Any user name is accepted; the password must
// match ADMIN_PASSWORD. Without a configured password (or a very short one)
// the page stays shut. Node's crypto, no library.
import { createHash, timingSafeEqual } from "node:crypto";

/** Shorter than this is not a password worth protecting data with. */
const MIN_LENGTH = 12;

export function adminAuthorized(header: string | null, password: string | undefined): boolean {
  if (!password || password.length < MIN_LENGTH) return false;
  if (!header?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
  const colon = decoded.indexOf(":");
  if (colon < 0) return false;
  // hash both sides so the comparison takes the same time whatever the lengths
  const given = createHash("sha256").update(decoded.slice(colon + 1)).digest();
  const expected = createHash("sha256").update(password).digest();
  return timingSafeEqual(given, expected);
}
