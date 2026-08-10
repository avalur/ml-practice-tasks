import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/* Password hashing with scrypt from Node's standard library.
 *
 * Deliberately no bcrypt/argon2 dependency: scrypt is memory-hard, ships with
 * the runtime, and one fewer native module is one fewer thing that breaks on a
 * serverless deploy. Parameters are stored next to the hash so they can be
 * raised later without invalidating existing passwords.
 */

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const N = 16384; // ~16 MB of memory per hash
const R = 8;
const P = 1;
const KEYLEN = 64;

export const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200; // scrypt cost is per-call, but don't hash a novel

/** Human-readable reason this password is unacceptable, or null if it is fine. */
export function passwordProblem(password: unknown, email?: string): string | null {
  if (typeof password !== "string" || password.length === 0) return "Enter a password.";
  if (password.length < MIN_PASSWORD) {
    return `Use at least ${MIN_PASSWORD} characters.`;
  }
  if (password.length > MAX_PASSWORD) return "That password is too long.";
  if (password.trim().length === 0) return "That password is only whitespace.";
  if (email && password.toLowerCase() === email.toLowerCase()) {
    return "Your password cannot be your email address.";
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

type Parsed = { salt: Buffer; expected: Buffer; N: number; r: number; p: number };

function parseHash(stored: string | null): Parsed | null {
  if (!stored) return null;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [, n, r, p, saltB64, keyB64] = parts;
  const parsed = {
    salt: Buffer.from(saltB64, "base64"),
    expected: Buffer.from(keyB64, "base64"),
    N: Number(n),
    r: Number(r),
    p: Number(p),
  };
  const sane = [parsed.N, parsed.r, parsed.p].every(Number.isInteger);
  return sane && parsed.salt.length > 0 && parsed.expected.length > 0 ? parsed : null;
}

/* What to verify against when the account has no usable hash — no such user, an
 * OAuth-only one, or a corrupted row. Without it those answer in microseconds
 * while a real account costs a scrypt, and that gap alone tells a stranger which
 * addresses are registered here.
 *
 * It is random bytes in the shape of a hash rather than a hash of anything: the
 * comparison is meant to fail, and building it this way keeps the work *exactly*
 * one scrypt, the same as a real account. Deriving it lazily with hashPassword()
 * would instead make the first absent-account request in each process cost two —
 * a cold-start signal, which on serverless is most of them.
 *
 * One caveat for the day N/R/P are raised: rows written with the old cost will
 * verify faster than this dummy. Re-hash on successful login at that point, so
 * the old cost disappears from the table. */
const DUMMY = [
  "scrypt",
  N,
  R,
  P,
  randomBytes(16).toString("base64"),
  randomBytes(KEYLEN).toString("base64"),
].join("$");

/** Constant-time check. False for any malformed or missing hash — and those
 *  still cost a full scrypt, so they cannot be told apart by timing. */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parsed = parseHash(stored);
  const { salt, expected, N: n, r, p } = parsed ?? (parseHash(DUMMY) as Parsed);
  let actual: Buffer;
  try {
    actual = await scryptAsync(password.normalize("NFKC"), salt, expected.length, { N: n, r, p });
  } catch {
    return false;
  }
  const match = actual.length === expected.length && timingSafeEqual(actual, expected);
  return parsed !== null && match;
}
