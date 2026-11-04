import { test, expect, type Browser } from "@playwright/test";

import {
  PUBLISH_SKIP_REASON,
  draftClass,
  isIsolatedDb,
  signInAs,
  teacherGrants,
} from "./support/session";

/* The platform-teacher role and its moderation.
 *
 * Several people act in one story here — an applicant, the admin, a student — so
 * each gets a browser context of their own. The admin is the synthetic editor
 * that ADMIN_EMAILS in .env.local must list. */
const ADMIN = { email: "e2e-admin@example.test", name: "E2E Admin" };
// Direct API calls must look same-origin, or crossSite() refuses them.
const ORIGIN = `http://localhost:${process.env.PORT || "3000"}`;

async function as(browser: Browser, who: { email: string; name: string; classSlug?: string; teacher?: boolean }) {
  const context = await browser.newContext();
  const session = await signInAs(context, who);
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept(d.type() === "prompt" ? "E2E reason" : undefined));
  return {
    page,
    session,
    async close() {
      await session.dispose();
      await context.close();
    },
  };
}

test("teach: apply, get approved by the admin, accept the terms", async ({ browser }) => {
  const email = `e2e-applicant-${process.pid}@example.test`;
  const grants = await teacherGrants();
  const applicant = await as(browser, { email, name: "E2E Applicant" });
  const admin = await as(browser, ADMIN);
  try {
    await applicant.page.goto("/teach");
    await applicant.page.locator('textarea[name="about"]').fill("I teach informatics at a test school.");
    await applicant.page.locator('textarea[name="plans"]').fill("Python basics for a class of 20 pupils.");
    await applicant.page.getByRole("button", { name: "Apply to teach" }).click();
    await expect(applicant.page.getByTestId("teach-pending")).toBeVisible();

    // A second application while one is pending is refused by the route.
    const again = await applicant.page.request.post("/api/teach/apply", {
      data: { about: "x".repeat(30), plans: "y".repeat(30) },
      headers: { origin: ORIGIN },
    });
    expect(again.status()).toBe(409);

    // The role does not exist yet: the terms route refuses.
    expect((await grants.grant(email))).toBeNull();

    await admin.page.goto("/admin/teachers");
    const card = admin.page.getByTestId(`application-${email}`);
    await expect(card).toContainText("Python basics for a class of 20 pupils.");
    await card.getByTestId("approve").click();
    await expect(card).toHaveCount(0);
    await expect(admin.page.getByTestId(`grant-${email}`)).toContainText("not yet");

    // Granted but not usable until the terms are accepted.
    await applicant.page.reload();
    await expect(applicant.page.getByTestId("teach-terms")).toBeVisible();
    await expect(applicant.page.getByTestId("accept-terms")).toBeDisabled();
    await applicant.page.getByLabel("I have read the terms above and agree to them.").check();
    await applicant.page.getByTestId("accept-terms").click();
    await expect(applicant.page.getByTestId("teach-active")).toBeVisible();
    expect((await grants.grant(email))?.termsVersion).toBeTruthy();

    // Revoking takes it away again, and /teach says so.
    await admin.page.reload();
    await admin.page.getByTestId(`grant-${email}`).getByTestId("revoke").click();
    await expect(admin.page.getByTestId(`grant-${email}`)).toContainText("revoked");
    await applicant.page.reload();
    await expect(applicant.page.getByTestId("teach-revoked")).toBeVisible();
  } finally {
    await applicant.close();
    await admin.close();
    await grants.dispose();
  }
});

test("teach: a rejected applicant sees the reviewer's note and may apply again", async ({ browser }) => {
  const email = `e2e-rejected-${process.pid}@example.test`;
  const grants = await teacherGrants();
  const applicant = await as(browser, { email, name: "E2E Rejected" });
  const admin = await as(browser, ADMIN);
  try {
    await applicant.page.goto("/teach");
    await applicant.page.locator('textarea[name="about"]').fill("Somebody who wants to teach here.");
    await applicant.page.locator('textarea[name="plans"]').fill("Something not quite fit for the site.");
    await applicant.page.getByRole("button", { name: "Apply to teach" }).click();
    await expect(applicant.page.getByTestId("teach-pending")).toBeVisible();

    await admin.page.goto("/admin/teachers");
    await admin.page.getByTestId(`application-${email}`).getByTestId("reject").click();
    await expect(admin.page.getByTestId(`application-${email}`)).toHaveCount(0);

    await applicant.page.reload();
    await expect(applicant.page.getByTestId("teach-rejected")).toContainText("E2E reason");
    await expect(applicant.page.getByTestId("teach-apply")).toBeVisible();
    expect((await grants.application(email))?.status).toBe("rejected");
    expect(await grants.grant(email)).toBeNull();
  } finally {
    await applicant.close();
    await admin.close();
    await grants.dispose();
  }
});

test("admin pages and routes are invisible to everybody else", async ({ browser, request }) => {
  const visitor = await as(browser, { email: `e2e-nobody-${process.pid}@example.test`, name: "E2E Nobody" });
  try {
    for (const path of ["/admin/teachers", "/admin/reports"]) {
      const res = await visitor.page.goto(path);
      expect(res?.status()).toBe(404);
    }
    const res = await visitor.page.request.post("/api/admin/teachers", {
      data: { action: "grant", email: `e2e-nobody-${process.pid}@example.test` },
      headers: { origin: ORIGIN },
    });
    expect(res.status()).toBe(403);
    // Signed out: same answer.
    const anon = await request.post("/api/admin/classes/ml-intensive-tlf/suspend", {
      data: { suspended: true, reason: "x" },
    });
    expect(anon.status()).toBe(403);
  } finally {
    await visitor.close();
  }
});

test("moderation: a report reaches the admin, and suspending hides the class from students", async ({ browser }) => {
  test.skip(!isIsolatedDb(), PUBLISH_SKIP_REASON);
  const slug = `e2e-moderated-${process.pid}`;
  const cls = await draftClass({ slug, title: "E2E Moderated", publishForStudents: true });
  const student = await as(browser, { email: `e2e-reporter-${process.pid}@example.test`, name: "E2E Reporter", classSlug: slug });
  const teacher = await as(browser, { email: `e2e-modteacher-${process.pid}@example.test`, name: "E2E Teacher", classSlug: slug, teacher: true });
  const admin = await as(browser, ADMIN);
  try {
    // The teacher has no report link on their own class.
    await teacher.page.goto(`/classes/${slug}`);
    await expect(teacher.page.getByTestId("publish-toggle")).toBeVisible();
    await expect(teacher.page.getByTestId("report-open")).toHaveCount(0);

    await student.page.goto(`/classes/${slug}`);
    await student.page.getByTestId("report-open").click();
    await student.page.getByLabel(/Asks for passwords/).check();
    await student.page.getByLabel("Details").fill("Slide 2 asks us to type our account password.");
    await student.page.getByRole("button", { name: "Send report" }).click();
    await expect(student.page.getByTestId("report-sent")).toBeVisible();

    await admin.page.goto("/admin/reports");
    const group = admin.page.getByTestId(`reports-${slug}`);
    await expect(group).toContainText("Slide 2 asks us to type our account password.");
    await group.getByTestId("suspend-toggle").click(); // prompt answered with "E2E reason"
    await expect(group.getByTestId("suspend-toggle")).toHaveText("Lift suspension");

    // Students: gone, and their group code enrolls nobody.
    const gone = await student.page.goto(`/classes/${slug}`);
    expect(gone?.status()).toBe(404);

    // Teachers: still there, told why, and Publish cannot undo it.
    await teacher.page.reload();
    await expect(teacher.page.getByTestId("suspended-note")).toContainText("E2E reason");
    await expect(teacher.page.getByTestId("publish-toggle")).toHaveCount(0);
    const republish = await teacher.page.request.post(`/api/classes/${slug}/publish`, {
      data: { published: true },
      headers: { origin: ORIGIN },
    });
    expect(republish.status()).toBe(403);

    // Closing the report leaves the class suspended; lifting the switch brings it back.
    await group.getByTestId("resolve").click();
    await expect(admin.page.getByTestId(`reports-${slug}`)).toHaveCount(0);
    await admin.page.goto(`/classes/${slug}`);
    await expect(admin.page.getByTestId("admin-bar")).toContainText("suspended");
    await admin.page.getByTestId("admin-bar").getByTestId("suspend-toggle").click();
    await expect(admin.page.getByTestId("admin-bar")).toContainText("published");

    const back = await student.page.goto(`/classes/${slug}`);
    expect(back?.status()).toBe(200);
  } finally {
    await student.close();
    await teacher.close();
    await admin.close();
    await cls.dispose();
  }
});
