import { test, expect } from "@playwright/test";

// Logged-out smoke: the header offers sign-in and both providers are wired.
// A full OAuth round-trip needs real provider credentials and isn't tested here.
test("logged out: Sign in shown and providers configured", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  const res = await request.get("/api/auth/providers");
  expect(res.ok()).toBeTruthy();
  const providers = await res.json();
  expect(Object.keys(providers)).toEqual(
    expect.arrayContaining(["github", "google"]),
  );
});
