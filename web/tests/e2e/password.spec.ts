import { test, expect } from "@playwright/test";
import { hashPassword, verifyPassword, passwordProblem } from "../../src/lib/password";

/* A unit test of the hashing module — no browser, no server. It lives here
 * because this is the only test runner the repo has, and Playwright specs are
 * plain Node.
 *
 * The timing test goes FIRST on purpose: it measures the first verifyPassword
 * call this process ever makes, which is the only moment a lazily-derived dummy
 * hash would show up. Nothing else imports this module, so declaration order
 * here is process order.
 */

test("no usable hash still costs exactly one scrypt — including the first call", async () => {
  const hash = await hashPassword("correct horse battery"); // hashing alone touches no shared state

  const once = async (stored: string | null) => {
    const t0 = performance.now();
    await verifyPassword("some guess", stored);
    return performance.now() - t0;
  };
  const median = async (stored: string | null) => {
    const runs = [await once(stored), await once(stored), await once(stored)];
    return runs.sort((a, b) => a - b)[1];
  };

  const coldAbsent = await once(null); // the very first verification in this process
  const real = await median(hash);

  /* "No such account" must not be the fast path: returning early on a null hash
   * makes this a few microseconds against ~100 ms for a real account, which is
   * enough to sort addresses into "registered here" and "not". Both cases count
   * — an absent hash is an unknown or OAuth-only address, a malformed one is a
   * corrupted row. */
  expect(real).toBeGreaterThan(5);
  expect(await median(null)).toBeGreaterThan(real * 0.5);
  expect(await median("not-a-hash")).toBeGreaterThan(real * 0.5);

  /* …and the first such request must not be slower either. Deriving the dummy
   * with hashPassword() on first use would cost two scrypts here, and on
   * serverless the first request is most of them. */
  expect(coldAbsent).toBeLessThan(real * 1.8);
});

test("scrypt hashes verify, and a wrong password does not", async () => {
  const hash = await hashPassword("correct horse battery");
  expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[\w+/=]+\$[\w+/=]+$/);
  // A fresh salt every time, so two identical passwords are not identical rows.
  expect(await hashPassword("correct horse battery")).not.toBe(hash);

  expect(await verifyPassword("correct horse battery", hash)).toBe(true);
  expect(await verifyPassword("Correct horse battery", hash)).toBe(false);
  expect(await verifyPassword("", hash)).toBe(false);
  // Unicode is normalized on both sides, so the same characters typed by a
  // different keyboard still open the account.
  const composed = await hashPassword("paßwort café xx");
  expect(await verifyPassword("paßwort café xx", composed)).toBe(true);

  // Anything that is not one of our hashes is refused rather than throwing.
  for (const junk of [null, "", "not-a-hash", "scrypt$1$2$3", `${hash}$extra`, "scrypt$x$8$1$AA$BB"]) {
    expect(await verifyPassword("correct horse battery", junk), String(junk)).toBe(false);
  }
});

test("passwordProblem rejects the passwords worth rejecting", () => {
  expect(passwordProblem("correct horse battery")).toBeNull();
  expect(passwordProblem("short")).toMatch(/at least 8/);
  expect(passwordProblem("")).toMatch(/Enter a password/);
  expect(passwordProblem(undefined)).toMatch(/Enter a password/);
  expect(passwordProblem("         ")).toMatch(/whitespace/);
  expect(passwordProblem("x".repeat(201))).toMatch(/too long/);
  expect(passwordProblem("Ada@Example.test", "ada@example.test")).toMatch(/cannot be your email/);
});
