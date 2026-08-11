import { test, expect } from "@playwright/test";
import { testAccount } from "./support/session";

/* Sign-in, email+password accounts and password reset.
 *
 * A password session is the same Session row Auth.js's adapter reads, so being
 * signed in is asserted the way the rest of the site sees it: the header shows
 * the account and /profile renders.
 *
 * A full OAuth round-trip needs real provider credentials and is not tested.
 */

const EMAIL = `e2e-pw-${process.pid}@example.test`;
const PASSWORD = "correct horse battery";
const NEW_PASSWORD = "another proper passphrase";

test("logged out: the sign-in page offers both providers and a password", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/signin/);
  await expect(page.getByRole("button", { name: /Continue with Google/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue with GitHub/ })).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();

  const res = await request.get("/api/auth/providers");
  expect(res.ok()).toBeTruthy();
  const providers = await res.json();
  expect(Object.keys(providers)).toEqual(expect.arrayContaining(["github", "google"]));
});

// The password tests share one address, so they must not overlap.
test.describe.configure({ mode: "serial" });

test("register, sign out, sign back in with the password", async ({ page }) => {
  const account = await testAccount(EMAIL);
  try {
    await page.goto("/register");
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel(/^First name/).fill("E2E");
    await page.getByLabel(/^Last name/).fill("Password User");
    await page.getByLabel(/^Password/).fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.locator(".auth-name")).toHaveText("E2E Password User");

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    expect(await account.sessionCount()).toBe(0);

    // A wrong password is refused, and says nothing about whether the account
    // exists — the same sentence answers both.
    await page.goto("/signin");
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill("not the password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Wrong email or password.")).toBeVisible();
    expect(await account.sessionCount()).toBe(0);

    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    expect(await account.sessionCount()).toBe(1);
  } finally {
    await account.remove();
  }
});

/* That the new name reaches a class roster is asserted where the roster is —
 * classes.spec.ts, "teacher: writes a group code…". */
test("the profile's Account tab sets both halves of the name", async ({ page }) => {
  const account = await testAccount(EMAIL);
  try {
    await page.goto("/register");
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel(/^First name/).fill("Typo");
    await page.getByLabel(/^Password/).fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/profile$/);

    await page.goto("/profile?tab=account");
    // The form starts from what the account already has, not empty.
    await expect(page.getByLabel(/^First name/)).toHaveValue("Typo");
    await page.getByLabel(/^First name/).fill("Ada");
    await page.getByLabel(/^Last name/).fill("Lovelace");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("account-saved")).toBeVisible();

    // Both halves are stored, and the display name every other page reads —
    // the header, class rosters, the monitor feed — is written from them.
    expect(await account.user()).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      name: "Ada Lovelace",
    });
    await expect(page.locator(".auth-name")).toHaveText("Ada Lovelace");

    /* A name longer than the cap is refused, not silently cut: the form is
     * prefilled from whatever the provider supplied, and someone who came to fix
     * the *other* field must not lose half a surname to a quiet truncation. */
    // page.request, not the `request` fixture: this call needs the session
    // cookie the browser context is holding.
    const long = await page.request.post("/api/account/profile", {
      data: { firstName: "Ada", lastName: "L".repeat(61) },
    });
    expect(long.status()).toBe(400);
    expect((await long.json()).error).toMatch(/Last name is too long/);
    expect(await account.user()).toMatchObject({ name: "Ada Lovelace" });

    // The removed "coming soon" entries are gone from the sidebar.
    await expect(page.getByText("Study Plan")).toHaveCount(0);
    await expect(page.getByText("Library")).toHaveCount(0);
  } finally {
    await account.remove();
  }
});

test("the same email cannot be registered twice", async ({ page, request }) => {
  const account = await testAccount(EMAIL);
  try {
    const first = await request.post("/api/account/register", {
      data: { email: EMAIL, password: PASSWORD, firstName: "First" },
    });
    expect(first.ok()).toBe(true);

    // Adopting an existing account would be a takeover: sign in with Google
    // once, and anyone who knows the address could register a password onto it.
    await page.goto("/register");
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel(/^Password/).fill("a different password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/already has an account/)).toBeVisible();

    // …and the first password still works, so nothing was overwritten.
    const login = await request.post("/api/account/login", {
      data: { email: EMAIL, password: PASSWORD },
    });
    expect(login.ok()).toBe(true);
  } finally {
    await account.remove();
  }
});

test("forgotten password: the link sets a new one and drops other sessions", async ({
  page,
  request,
}) => {
  const account = await testAccount(EMAIL);
  try {
    await request.post("/api/account/register", {
      data: { email: EMAIL, password: PASSWORD, firstName: "Forgetful" },
    });
    expect(await account.sessionCount()).toBe(1); // from registering

    await page.goto("/forgot-password");
    await page.getByLabel("Your email").fill(EMAIL);
    await page.getByRole("button", { name: "Email me a link" }).click();
    await expect(page.getByTestId("forgot-sent")).toContainText(/If that email has an account/);
    expect(await account.resetTokenCount()).toBe(1);

    // An address with no account gets the identical answer — the endpoint is not
    // a way to find out who has an account here.
    const stranger = await request.post("/api/account/forgot-password", {
      data: { email: `nobody-${process.pid}@example.test` },
    });
    expect(stranger.ok()).toBe(true);
    expect((await stranger.json()).message).toMatch(/If that email has an account/);

    // The mailed token exists only in the email (the table holds its hash), so
    // the test issues an equivalent one and walks the page.
    const token = await account.issueResetToken();
    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel(/^New password/).fill(NEW_PASSWORD);
    await page.getByRole("button", { name: /Set password/ }).click();
    await expect(page).toHaveURL(/\/profile$/);

    // One session — the new one. Whoever held the old password is signed out,
    // and every unused link is dead.
    expect(await account.sessionCount()).toBe(1);
    expect(await account.resetTokenCount()).toBe(0);

    const replay = await request.post("/api/account/reset-password", {
      data: { token, password: "yet another password" },
    });
    expect(replay.status()).toBe(400);
    const old = await request.post("/api/account/login", {
      data: { email: EMAIL, password: PASSWORD },
    });
    expect(old.status()).toBe(401);
    const fresh = await request.post("/api/account/login", {
      data: { email: EMAIL, password: NEW_PASSWORD },
    });
    expect(fresh.ok()).toBe(true);
  } finally {
    await account.remove();
  }
});

test("an expired link is refused", async ({ request }) => {
  const account = await testAccount(EMAIL);
  try {
    await request.post("/api/account/register", { data: { email: EMAIL, password: PASSWORD } });
    const token = await account.issueResetToken({ expiresAt: new Date(Date.now() - 1000) });
    const res = await request.post("/api/account/reset-password", {
      data: { token, password: NEW_PASSWORD },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/expired/);
  } finally {
    await account.remove();
  }
});

// These endpoints set session cookies, change passwords and enroll students, and
// SameSite=Lax still lets another site POST to them. Auth.js's CSRF token covers
// only the routes it serves, so they check the origin themselves.
const MUTATIONS = [
  "/api/account/register",
  "/api/account/login",
  "/api/account/forgot-password",
  "/api/account/reset-password",
  "/api/account/profile",
  "/api/classes/join",
];

/* Every mutation checks the origin *before* it looks at who is calling, so a
 * teacher-only route belongs in this list too — even though it answers 403 to a
 * stranger and therefore has no place in the body test below. The slug does not
 * have to exist: nothing is looked up until the origin passes. */
const CROSS_SITE = [
  ...MUTATIONS,
  "/api/classes/no-such-class/publish",
  "/api/brainteasers/abacus/publish",
];

test("a cross-site POST is refused", async ({ request }) => {
  for (const path of CROSS_SITE) {
    const res = await request.post(path, {
      headers: { origin: "https://evil.example" },
      data: { email: EMAIL, password: PASSWORD, token: "x", code: "x" },
    });
    expect(res.status(), path).toBe(403);
  }

  // Same host, wrong scheme, is still another origin.
  const downgraded = await request.post("/api/account/login", {
    headers: { origin: "http://localhost:3000", "x-forwarded-proto": "https" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(downgraded.status()).toBe(403);
});

// A JSON body that parses but is not an object used to reach the first property
// read and answer 500.
test("a non-object JSON body is a 400, not a 500", async ({ request }) => {
  for (const path of MUTATIONS) {
    for (const data of [null, 42, "a string", [1, 2]]) {
      const res = await request.post(path, { data });
      expect([400, 401], `${path} with ${JSON.stringify(data)}`).toContain(res.status());
    }
  }
});

test("a too-short password creates nothing", async ({ request }) => {
  const email = `e2e-weak-${process.pid}@example.test`;
  const account = await testAccount(email);
  try {
    const res = await request.post("/api/account/register", {
      data: { email, password: "short" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/at least 8/);
    expect(await account.exists()).toBe(false);
  } finally {
    await account.remove();
  }
});
