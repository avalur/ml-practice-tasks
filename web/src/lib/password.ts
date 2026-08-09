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

/** Constant-time check. False for any malformed or missing hash. */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  let actual: Buffer;
  try {
    actual = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
