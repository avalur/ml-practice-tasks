import { test, expect } from "@playwright/test";
import { signInAs } from "./support/session";

/* The site shell and the two cabinets: the student's /profile/* and the
 * teacher's /teach dashboard with the class tab bar. */

const CLASS = "ml-intensive-tlf";

test("an unknown page is the site's own 404, with the header", async ({ page }) => {
  const res = await page.goto("/no-such-page-anywhere");
  expect(res?.status()).toBe(404);
  await expect(page.getByTestId("not-found")).toBeVisible();
  await expect(page.locator(".site-header")).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse problems" })).toBeVisible();
});

test("phone width: the header fits and its menu opens", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/classes");
  // Nothing may push the page sideways — that is what the old header did.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const problems = page.locator("#site-nav").getByRole("link", { name: "Problems" });
  await expect(problems).toBeHidden();
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(problems).toBeVisible();
  // The current section is marked, for screen readers as well as the eye.
  await expect(page.locator("#site-nav").getByRole("link", { name: "Classes" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await problems.click();
  await expect(page).toHaveURL(/\/problems$/);
  await expect(problems).toBeHidden();
});

test("student cabinet: overview, the class card, and the old ?tab= links", async ({
  context,
  page,
}) => {
  const student = await signInAs(context, {
    email: `e2e-cabinet-${process.pid}@example.test`,
    name: "E2E Cabinet Student",
    classSlug: CLASS,
  });
  try {
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Welcome back, E2E" })).toBeVisible();
    await expect(page.getByTestId("overview-stats")).toBeVisible();
    // Enrolled in a class with homework: it is listed under "Up next" or the
    // class is caught up — either way not the "join a class" empty state.
    await expect(page.getByTestId("overview-up-next")).not.toContainText(
      "You are not in a class yet",
    );

    await page.goto("/profile/classes");
    const card = page.getByTestId("my-classes").getByRole("link").first();
    await expect(card).toHaveAttribute("href", `/classes/${CLASS}`);
    await expect(card).toContainText("E2E group");
    await expect(card.getByRole("progressbar")).toBeVisible();

    // Every old tab still lands on its page.
    for (const [tab, path] of [
      ["submissions", "/profile/submissions"],
      ["favorites", "/profile/favorites"],
      ["notebooks", "/profile/assignments"],
      ["classes", "/profile/classes"],
      ["account", "/profile/account"],
    ]) {
      await page.goto(`/profile?tab=${tab}`);
      await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}$`));
    }
    // …and the sidebar marks where you are.
    await expect(
      page.locator(".profile-nav").getByRole("link", { name: "Account" }),
    ).toHaveAttribute("aria-current", "page");
  } finally {
    await student.dispose();
  }
});

test("signed out, the cabinet asks you to sign in instead of erroring", async ({ page }) => {
  for (const path of ["/profile", "/profile/assignments", "/profile/account"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByRole("link", { name: "Sign in" }).last()).toBeVisible();
  }
});

test("teacher: the dashboard lists the class, and the tab bar links its views", async ({
  context,
  page,
}) => {
  const teacher = await signInAs(context, {
    email: "e2e-dashboard-teacher@example.test",
    name: "E2E Dashboard Teacher",
    classSlug: CLASS,
    teacher: true,
  });
  try {
    await page.goto("/teach");
    await expect(page.getByRole("heading", { name: "Teaching", exact: true })).toBeVisible();
    const card = page.getByTestId(`teach-class-${CLASS}`);
    await expect(card).toBeVisible();
    await expect(page.getByTestId("stat-to-grade")).toBeVisible();

    await card.getByRole("link", { name: "Group codes" }).click();
    await expect(page).toHaveURL(new RegExp(`/classes/${CLASS}/homework\\?tab=groups$`));
    await expect(page.getByRole("heading", { name: "Group codes" })).toBeVisible();

    const nav = page.getByTestId("class-teacher-nav");
    await expect(nav.getByRole("link", { name: "Group codes" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await nav.getByTestId("teacher-tab-grading").click();
    await expect(page.getByTestId("grading-pending")).toBeVisible();
    await nav.getByTestId("teacher-tab-attendance").click();
    await expect(nav.getByTestId("teacher-tab-attendance")).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Live monitor" }).click();
    await expect(page).toHaveURL(new RegExp(`/classes/${CLASS}/monitor$`));
  } finally {
    await teacher.dispose();
  }
});
