import { test, expect } from "@playwright/test";
import { crossSite, jsonBody, rateLimited, siteOrigin } from "../../src/lib/http";

/* Unit tests for the guards every mutation route now starts with — no browser,
 * no server. */

const post = (headers: Record<string, string>, url = "https://mlpractice.com/api/x") =>
  new Request(url, { method: "POST", headers });

test("crossSite compares the whole origin, scheme included", () => {
  // A same-origin fetch may omit Origin entirely; there is no cross-site risk
  // in a request a browser would not attach it to.
  expect(crossSite(post({ host: "mlpractice.com" }))).toBe(false);

  expect(crossSite(post({ origin: "https://mlpractice.com", host: "mlpractice.com" }))).toBe(false);
  expect(crossSite(post({ origin: "https://evil.example", host: "mlpractice.com" }))).toBe(true);

  // Same host over plain http is a different origin, and used to pass.
  expect(crossSite(post({ origin: "http://mlpractice.com", host: "mlpractice.com" }))).toBe(true);

  // Behind the proxy the scheme comes from the forwarded header.
  expect(
    crossSite(
      post({
        origin: "https://mlpractice.com",
        "x-forwarded-host": "mlpractice.com",
        "x-forwarded-proto": "https",
      }),
    ),
  ).toBe(false);

  expect(crossSite(post({ origin: "garbage", host: "mlpractice.com" }))).toBe(true);
});

test("jsonBody accepts objects and nothing else", async () => {
  const withBody = (body: string) =>
    new Request("https://mlpractice.com/api/x", { method: "POST", body });

  expect(await jsonBody(withBody('{"a":1}'))).toEqual({ a: 1 });
  // Each of these used to reach the first property read and answer 500.
  for (const body of ["null", "42", '"a string"', "[1,2]", "not json", ""]) {
    expect(await jsonBody(withBody(body)), body).toBeNull();
  }
});

test("siteOrigin prefers the configured origin over the request's Host", () => {
  const req = post({ host: "attacker.example" }, "https://attacker.example/api/x");
  const before = process.env.SITE_URL;
  try {
    process.env.SITE_URL = "https://www.mlpractice.com/";
    expect(siteOrigin(req)).toBe("https://www.mlpractice.com"); // trailing slash trimmed
    delete process.env.SITE_URL;
    // Unconfigured, it falls back to the request — fine locally, which is why
    // production must set SITE_URL.
    expect(siteOrigin(req)).toBe("https://attacker.example");
  } finally {
    if (before === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = before;
  }
});

test("rateLimited counts per bucket and per address", () => {
  const from = (ip: string) => post({ "x-forwarded-for": `${ip}, 10.0.0.1` });
  const ip = `203.0.113.${process.pid % 200}`;

  for (let i = 0; i < 3; i++) expect(rateLimited(from(ip), "t-a", 3, 60_000), `${i}`).toBe(false);
  expect(rateLimited(from(ip), "t-a", 3, 60_000)).toBe(true);

  // A different endpoint and a different client are unaffected.
  expect(rateLimited(from(ip), "t-b", 3, 60_000)).toBe(false);
  expect(rateLimited(from("198.51.100.7"), "t-a", 3, 60_000)).toBe(false);
});
