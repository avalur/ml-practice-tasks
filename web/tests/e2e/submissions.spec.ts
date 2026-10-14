import { test, expect } from "@playwright/test";
import {
  draftClass as rawDraftClass,
  signInAs as rawSignInAs,
  isIsolatedDb,
  PUBLISH_SKIP_REASON,
} from "./support/session";
import path from "node:path";
import fs from "node:fs";
import { getStoreIdFromToken } from "../../src/lib/submissions";

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const file = path.join(__dirname, "..", "..", ".env.local");
  const line = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .find((l) => l.trim().startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL not found in env or .env.local");
  return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

function blobToken(): string | null {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const file = path.join(__dirname, "..", "..", ".env.local");
  if (!fs.existsSync(file)) return null;
  const line = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .find((l) => l.trim().startsWith("BLOB_READ_WRITE_TOKEN="));
  if (!line) return null;
  return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

/* Everything a test creates is registered here the moment it exists, and torn
 * down in afterEach even when setup throws half-way (e.g. sign-in failing after
 * the scratch class was written). Every dispose() is idempotent. */
const created: Array<() => Promise<unknown>> = [];
async function track<T extends { dispose: () => Promise<void> }>(p: Promise<T>): Promise<T> {
  const v = await p;
  created.push(() => v.dispose());
  return v;
}
const draftClass = (...a: Parameters<typeof rawDraftClass>) => track(rawDraftClass(...a));
const signInAs = (...a: Parameters<typeof rawSignInAs>) => track(rawSignInAs(...a));
test.afterEach(async () => {
  while (created.length) await created.pop()!().catch(() => {});
});

/** Published scratch classes need an isolated DB; on the live one they skip. */
function skipUnlessIsolated() {
  test.skip(!isIsolatedDb(), PUBLISH_SKIP_REASON);
}

async function checkNotebookSubmissionsTableExists(): Promise<boolean> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl() });
  try {
    await prisma.notebookSubmission.count();
    return true;
  } catch {
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

test.describe("Submission, Download, and Grading Routes", () => {
  test("crossSite requests are refused on all submission mutation endpoints", async ({
    request,
  }) => {
    const crossHeaders = {
      origin: "https://evil.example",
      host: "localhost:3000",
      "content-type": "application/json",
    };

    // 1. Upload token route
    const tokenRes = await request.post("/api/blob/upload-submission-token", {
      headers: crossHeaders,
      data: { clientPayload: JSON.stringify({ classSlug: "test", lessonSlug: "l1", assignmentId: "a1" }) },
    });
    expect(tokenRes.status()).toBe(403);
    const tokenJson = await tokenRes.json();
    expect(tokenJson.error).toMatch(/cross-site/i);

    // 2. Submission create route
    const subRes = await request.post("/api/classes/building-ai-agents/lessons/l02-tools-mcp/submissions", {
      headers: crossHeaders,
      data: { assignmentId: "a1", fileUrl: "https://store.blob.vercel-storage.com/test.ipynb" },
    });
    expect(subRes.status()).toBe(403);
    const subJson = await subRes.json();
    expect(subJson.error).toMatch(/cross-site/i);

    // 3. Teacher grading route
    const gradeRes = await request.post("/api/classes/building-ai-agents/lessons/l02-tools-mcp/submissions/sub-123/grade", {
      headers: crossHeaders,
      data: { grade: 90, feedback: "Good job" },
    });
    expect(gradeRes.status()).toBe(403);
    const gradeJson = await gradeRes.json();
    expect(gradeJson.error).toMatch(/cross-site/i);
  });

  test("route authorization: non-enrolled users and non-teachers are rejected", async ({
    browser,
  }) => {
    skipUnlessIsolated();
    // Scratch class under a unique e2e- slug, published only for the seconds this
    // test runs (a draft is 404 for students) and deleted in finally.
    const draftFixture = await draftClass({
      slug: `e2e-sub-draft-${process.pid}`,
      title: `E2E Sub Draft ${process.pid}`,
      lesson: "l01-scratch",
      publishForStudents: true,
      homework: {
        due: "2026-10-20T23:59:00Z",
        items: [
          {
            type: "assignment",
            id: "hw-draft",
            title: "Draft Homework",
            maxScore: 100,
          },
        ],
      },
    });

    const teacherCtx = await browser.newContext();
    const teacher = await signInAs(teacherCtx, {
      email: `e2e-sub-teacher-${process.pid}@example.test`,
      name: "E2E Sub Teacher",
      classSlug: draftFixture.slug,
      teacher: true,
    });

    const studentCtx = await browser.newContext();
    const student = await signInAs(studentCtx, {
      email: `e2e-sub-student-${process.pid}@example.test`,
      name: "E2E Sub Student",
      classSlug: draftFixture.slug,
    });

    const outsiderCtx = await browser.newContext();
    const outsider = await signInAs(outsiderCtx, {
      email: `e2e-sub-outsider-${process.pid}@example.test`,
      name: "E2E Sub Outsider",
      // Not enrolled in draftFixture
    });

    try {
      // Without a Blob store the token route answers 501 before it looks at anybody.
      const blobConfigured = !!blobToken();

      // (a) Outsider cannot request upload token (returns 403 Forbidden with well-formed body)
      const outsiderTokenRes = await outsiderCtx.request.post("/api/blob/upload-submission-token", {
        data: {
          type: "blob.generate-client-token",
          payload: {
            pathname: `classes/${draftFixture.slug}/${draftFixture.lessonSlug}/submissions/${outsider.userId}/hw-draft/test.ipynb`,
            clientPayload: JSON.stringify({
              classSlug: draftFixture.slug,
              lessonSlug: draftFixture.lessonSlug,
              assignmentId: "hw-draft",
            }),
            multipart: false,
          },
        },
      });
      if (blobConfigured) {
        expect(outsiderTokenRes.status()).toBe(403);
        const outsiderTokenJson = await outsiderTokenRes.json();
        expect(outsiderTokenJson.error).toMatch(/forbidden: not enrolled in this class/i);
      } else {
        expect(outsiderTokenRes.status()).toBe(501);
      }

      // (b) Enrolled student attempting to generate upload token with another user's pathname is refused (403)
      const swapTokenRes = await studentCtx.request.post("/api/blob/upload-submission-token", {
        data: {
          type: "blob.generate-client-token",
          payload: {
            pathname: `classes/${draftFixture.slug}/${draftFixture.lessonSlug}/submissions/${outsider.userId}/hw-draft/test.ipynb`,
            clientPayload: JSON.stringify({
              classSlug: draftFixture.slug,
              lessonSlug: draftFixture.lessonSlug,
              assignmentId: "hw-draft",
            }),
            multipart: false,
          },
        },
      });
      if (blobConfigured) {
        expect(swapTokenRes.status()).toBe(403);
        const swapTokenJson = await swapTokenRes.json();
        expect(swapTokenJson.error).toMatch(/pathname must sit under/i);
      } else {
        expect(swapTokenRes.status()).toBe(501);
      }

      // (c) Non-teacher cannot grade (teachers only, returns 403)
      const studentGradeRes = await studentCtx.request.post(
        `/api/classes/${draftFixture.slug}/lessons/${draftFixture.lessonSlug}/submissions/sub-fake/grade`,
        { data: { grade: 90, feedback: "Attempted self-grade" } },
      );
      expect(studentGradeRes.status()).toBe(403);
      const studentGradeJson = await studentGradeRes.json();
      expect(studentGradeJson.error).toMatch(/teachers only/i);

      // (d) Outsider cannot download student submission (returns 404)
      const outsiderDownloadRes = await outsiderCtx.request.get(
        `/api/classes/${draftFixture.slug}/lessons/${draftFixture.lessonSlug}/submissions/sub-fake/download`,
      );
      expect(outsiderDownloadRes.status()).toBe(404);
    } finally {
      await teacher.dispose();
      await teacherCtx.close();
      await student.dispose();
      await studentCtx.close();
      await outsider.dispose();
      await outsiderCtx.close();
      await draftFixture.dispose();
    }
  });

  test("teacher UI: homework matrix renders assignment columns and review modal for not-submitted student", async ({
    browser,
  }) => {
    const tableExists = await checkNotebookSubmissionsTableExists();
    test.skip(
      !tableExists,
      "NotebookSubmission table is not pushed to the live database (run prisma db push to enable)",
    );

    const draftFixture = await draftClass({
      slug: `e2e-matrix-${process.pid}`,
      title: `E2E Matrix ${process.pid}`,
      lesson: "l01-scratch",
      homework: {
        due: "2026-10-20T23:59:00Z",
        items: [
          {
            type: "assignment",
            id: "matrix-agent",
            title: "Matrix ReAct Agent",
            maxScore: 100,
          },
        ],
      },
    });

    const teacherCtx = await browser.newContext();
    const teacher = await signInAs(teacherCtx, {
      email: `e2e-matrix-teacher-${process.pid}@example.test`,
      name: "E2E Matrix Teacher",
      classSlug: draftFixture.slug,
      teacher: true,
    });

    const studentCtx = await browser.newContext();
    const student = await signInAs(studentCtx, {
      email: `e2e-matrix-student-${process.pid}@example.test`,
      name: "E2E Matrix Student",
      classSlug: draftFixture.slug,
    });

    try {
      const page = await teacherCtx.newPage();
      await page.goto(`/classes/${draftFixture.slug}/homework?lesson=${draftFixture.lessonSlug}`);

      // Verify page loaded and assignment column header exists
      await expect(page.getByRole("heading", { name: "Lesson 1. Scratch" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: /Matrix ReAct Agent|matrix-agent/i })).toBeVisible();

      // Find the student's assignment cell
      const cell = page.getByTestId(`sub-cell-${student.userId}-matrix-agent`);
      await expect(cell).toBeVisible();
      await expect(cell).toHaveText("·");

      // Click cell to open review modal
      await cell.click();

      // Verify modal elements
      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();
      await expect(modal.getByRole("heading", { name: /Matrix ReAct Agent/i })).toBeVisible();
      await expect(modal.getByText("Not Submitted", { exact: true })).toBeVisible();
      await expect(modal.getByText("E2E Matrix Student")).toBeVisible();
      await expect(modal.getByText(/has not submitted a notebook for this assignment yet/i)).toBeVisible();

      // Close modal
      await page.getByTestId("submission-cancel-btn").click();
      await expect(modal).toHaveCount(0);
    } finally {
      await teacher.dispose();
      await teacherCtx.close();
      await student.dispose();
      await studentCtx.close();
      await draftFixture.dispose();
    }
  });

  test("teacher grading UI: optimistic update with delayed response, failure rollback, and success confirmation", async ({
    browser,
  }) => {
    const tableExists = await checkNotebookSubmissionsTableExists();
    test.skip(
      !tableExists,
      "NotebookSubmission table is not pushed to the live database (run prisma db push to enable)",
    );

    const draftFixture = await draftClass({
      slug: `e2e-rollback-${process.pid}`,
      title: `E2E Rollback ${process.pid}`,
      lesson: "l01-scratch",
      homework: {
        due: "2026-10-20T23:59:00Z",
        items: [
          {
            type: "assignment",
            id: "rollback-agent",
            title: "Rollback ReAct Agent",
            maxScore: 100,
          },
        ],
      },
    });

    const teacherCtx = await browser.newContext();
    const teacherEmail = `e2e-rollback-teacher-${process.pid}@example.test`;
    const teacher = await signInAs(teacherCtx, {
      email: teacherEmail,
      name: "E2E Rollback Teacher",
      classSlug: draftFixture.slug,
      teacher: true,
    });

    const studentCtx = await browser.newContext();
    const student = await signInAs(studentCtx, {
      email: `e2e-rollback-student-${process.pid}@example.test`,
      name: "E2E Rollback Student",
      classSlug: draftFixture.slug,
    });

    const { PrismaClient } = await import("@prisma/client");
    const prismaLive = new PrismaClient({ datasourceUrl: databaseUrl() });
    let scratchSubId: string | null = null;
    let clsRowId: string | null = null;

    try {
      const clsRow = await prismaLive.class.findUniqueOrThrow({
        where: { slug: draftFixture.slug },
        select: { id: true },
      });
      clsRowId = clsRow.id;

      // Seed real scratch submission in DB so the table matrix renders "Review" naturally without backdoor
      const created = await prismaLive.notebookSubmission.create({
        data: {
          userId: student.userId,
          classId: clsRow.id,
          lessonSlug: draftFixture.lessonSlug,
          assignmentId: "rollback-agent",
          fileUrl: `https://mock.blob.vercel-storage.com/classes/${draftFixture.slug}/scratch-${student.userId}.ipynb`,
          fileName: "scratch.ipynb",
          fileBytes: 2048,
          status: "submitted",
          maxGrade: 100,
        },
      });
      scratchSubId = created.id;

      const page = await teacherCtx.newPage();

      // Set up delayed route for 500 error
      let releaseRoute: (() => void) | null = null;
      let routeWait = new Promise<void>((resolve) => {
        releaseRoute = resolve;
      });

      await page.route("**/submissions/**/grade", async (route) => {
        if (releaseRoute) {
          await routeWait;
        }
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Database offline: simulated failure" }),
        });
      });

      // Load homework page
      await page.goto(`/classes/${draftFixture.slug}/homework?lesson=${draftFixture.lessonSlug}`);

      const subCell = page.getByTestId(`sub-cell-${student.userId}-rollback-agent`);
      await expect(subCell).toBeVisible();
      await expect(subCell).toHaveText("Review");

      // Open review modal
      await subCell.click();
      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();

      // Verify tabs have accessible roles
      const writeTab = page.getByTestId("feedback-tab-write");
      const previewTab = page.getByTestId("feedback-tab-preview");
      await expect(writeTab).toHaveAttribute("role", "tab");
      await expect(writeTab).toHaveAttribute("aria-selected", "true");
      await expect(previewTab).toHaveAttribute("role", "tab");
      await expect(previewTab).toHaveAttribute("aria-selected", "false");

      // Type grade and feedback
      await page.getByTestId("submission-grade-input").fill("88");
      await page.getByTestId("submission-feedback-input").fill("**Needs improvement** on step 3.");

      // Check preview
      await previewTab.click();
      await expect(
        page.getByTestId("submission-feedback-preview").locator("strong"),
      ).toHaveText("Needs improvement");
      await writeTab.click();

      // Submit form
      const saveBtn = page.getByTestId("submission-save-grade-btn");
      await saveBtn.click();

      // PROVE INTERMEDIATE OPTIMISTIC STATE: while request is delayed in-flight, cell immediately shows 88/100!
      await expect(subCell).toHaveText("88/100");

      // Release route to let 500 error complete
      releaseRoute!();

      // PROVE ROLLBACK: server returned 500, so cell rolls back to "Review"!
      await expect(subCell).toHaveText("Review");

      // Modal MUST remain open and display the visible error
      await expect(modal).toBeVisible();
      const errorMsg = page.getByTestId("submission-grade-error");
      await expect(errorMsg).toBeVisible();
      await expect(errorMsg).toHaveText("Database offline: simulated failure");

      // Typed inputs MUST NOT be wiped out
      await expect(page.getByTestId("submission-grade-input")).toHaveValue("88");
      await expect(page.getByTestId("submission-feedback-input")).toHaveValue(
        "**Needs improvement** on step 3.",
      );

      // Save button must be re-enabled for retry
      await expect(saveBtn).toBeEnabled();

      // Now test SUCCESS path with delayed response
      let releaseSuccess: (() => void) | null = null;
      const successWait = new Promise<void>((resolve) => {
        releaseSuccess = resolve;
      });

      await page.unroute("**/submissions/**/grade");
      await page.route("**/submissions/**/grade", async (route) => {
        if (releaseSuccess) {
          await successWait;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            submission: {
              id: scratchSubId,
              userId: student.userId,
              classId: clsRowId,
              lessonSlug: draftFixture.lessonSlug,
              assignmentId: "rollback-agent",
              fileUrl: `https://mock.blob.vercel-storage.com/classes/${draftFixture.slug}/scratch-${student.userId}.ipynb`,
              fileName: "scratch.ipynb",
              fileBytes: 2048,
              submittedAt: new Date().toISOString(),
              status: "graded",
              grade: 88,
              maxGrade: 100,
              feedback: "**Needs improvement** on step 3.",
              gradedBy: teacherEmail,
              gradedAt: new Date().toISOString(),
            },
          }),
        });
      });

      // Submit again
      await saveBtn.click();

      // PROVE INTERMEDIATE OPTIMISTIC STATE on second submit
      await expect(subCell).toHaveText("88/100");

      // Release success route
      releaseSuccess!();

      // PROVE SUCCESS: cell stays 88/100 and modal closes
      await expect(subCell).toHaveText("88/100");
      await expect(modal).toHaveCount(0);

      await page.close();
    } finally {
      if (scratchSubId) {
        await prismaLive.notebookSubmission.deleteMany({
          where: { id: scratchSubId },
        });
      }
      await prismaLive.$disconnect();
      await teacher.dispose();
      await teacherCtx.close();
      await student.dispose();
      await studentCtx.close();
      await draftFixture.dispose();
    }
  });

  test("database-backed grading and regression for duplicate submissions (when table exists)", async ({
    browser,
  }) => {
    skipUnlessIsolated();
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient({ datasourceUrl: databaseUrl() });

    let tableExists = false;
    try {
      await prisma.notebookSubmission.count();
      tableExists = true;
    } catch {
      tableExists = false;
    } finally {
      await prisma.$disconnect();
    }

    test.skip(
      !tableExists,
      "NotebookSubmission table is not pushed to the live database (run prisma db push to enable)",
    );

    const draftFixture = await draftClass({
      slug: `e2e-grade-db-${process.pid}`,
      title: `E2E Grade DB ${process.pid}`,
      lesson: "l01-scratch",
      publishForStudents: true,
      homework: {
        due: "2026-10-20T23:59:00Z",
        items: [
          {
            type: "assignment",
            id: "scratch-react-agent",
            title: "Build a ReAct Agent from Scratch",
            maxScore: 100,
          },
        ],
      },
    });

    const teacherCtx = await browser.newContext();
    const teacher = await signInAs(teacherCtx, {
      email: `e2e-grade-teacher-${process.pid}@example.test`,
      name: "E2E Grade Teacher",
      classSlug: draftFixture.slug,
      teacher: true,
    });

    const studentCtx = await browser.newContext();
    const student = await signInAs(studentCtx, {
      email: `e2e-grade-student-${process.pid}@example.test`,
      name: "E2E Grade Student",
      classSlug: draftFixture.slug,
    });

    const otherStudentCtx = await browser.newContext();
    const otherStudent = await signInAs(otherStudentCtx, {
      email: `e2e-grade-other-${process.pid}@example.test`,
      name: "E2E Other Student",
      classSlug: draftFixture.slug,
    });

    const prismaLive = new PrismaClient({ datasourceUrl: databaseUrl() });
    let submissionId: string | null = null;
    try {
      // Enrolled student generates token for their own pathname (positive case: returns 200 with clientToken)
      const validTokenRes = await studentCtx.request.post("/api/blob/upload-submission-token", {
        data: {
          type: "blob.generate-client-token",
          payload: {
            pathname: `classes/${draftFixture.slug}/${draftFixture.lessonSlug}/submissions/${student.userId}/scratch-react-agent/test.ipynb`,
            clientPayload: JSON.stringify({
              classSlug: draftFixture.slug,
              lessonSlug: draftFixture.lessonSlug,
              assignmentId: "scratch-react-agent",
            }),
            multipart: false,
          },
        },
      });
      const validText = await validTokenRes.text();
      if (blobToken()) {
        expect(validTokenRes.status(), `validTokenRes: ${validText}`).toBe(200);
        expect(JSON.parse(validText).clientToken).toBeDefined();
      } else {
        expect(validTokenRes.status(), `validTokenRes: ${validText}`).toBe(501);
      }

      const clsRow = await prismaLive.class.findUniqueOrThrow({ where: { slug: draftFixture.slug } });
      const storeId = getStoreIdFromToken(blobToken()) ?? "ltlwiewbm3wq0yac";
      const fileUrl = `https://${storeId}.private.blob.vercel-storage.com/classes/${draftFixture.slug}/${draftFixture.lessonSlug}/submissions/${student.userId}/scratch-react-agent/notebook.ipynb`;
      const created = await prismaLive.notebookSubmission.create({
        data: {
          userId: student.userId,
          classId: clsRow.id,
          lessonSlug: draftFixture.lessonSlug,
          assignmentId: "scratch-react-agent",
          fileUrl,
          fileName: "notebook.ipynb",
          fileBytes: 1024,
          status: "submitted",
          maxGrade: 100,
        },
      });
      submissionId = created.id;

      // Other student tries to download: must return 404
      const otherDownload = await otherStudentCtx.request.get(
        `/api/classes/${draftFixture.slug}/lessons/${draftFixture.lessonSlug}/submissions/${submissionId}/download`,
      );
      expect(otherDownload.status()).toBe(404);

      // Teacher reviews and grades via homework matrix UI
      const page = await teacherCtx.newPage();
      await page.goto(`/classes/${draftFixture.slug}/homework?lesson=${draftFixture.lessonSlug}`);

      const subCell = page.getByTestId(`sub-cell-${student.userId}-scratch-react-agent`);
      await expect(subCell).toBeVisible();
      await expect(subCell).toHaveText("Review");

      // Open review modal
      await subCell.click();
      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();
      await expect(modal.getByText("Submitted · Awaiting Review")).toBeVisible();

      // Download button check
      const dlBtn = page.getByTestId("submission-download-btn");
      await expect(dlBtn).toBeVisible();
      await expect(dlBtn).toHaveAttribute(
        "href",
        `/api/classes/${draftFixture.slug}/lessons/${draftFixture.lessonSlug}/submissions/${created.id}/download`,
      );

      // Input grade and feedback
      await page.getByTestId("submission-grade-input").fill("95");
      await page.getByTestId("submission-feedback-input").fill("**Excellent** implementation!");

      // Markdown preview
      await page.getByTestId("feedback-tab-preview").click();
      await expect(page.getByTestId("submission-feedback-preview").locator("strong")).toHaveText("Excellent");
      await page.getByTestId("feedback-tab-write").click();

      // Save grade
      await page.getByTestId("submission-save-grade-btn").click();

      // Verify optimistic update on table cell
      await expect(modal).toHaveCount(0);
      await expect(subCell).toHaveText("95/100");
      await page.close();

      // Student views feedback in personal profile (/profile?tab=notebooks)
      const studentPage = await studentCtx.newPage();
      await studentPage.goto("/profile?tab=notebooks");
      await expect(studentPage.getByTestId("notebook-assignment-list")).toBeVisible();
      const profCard = studentPage.getByTestId("assignment-card-scratch-react-agent");
      await expect(profCard).toBeVisible();
      await expect(profCard.getByTestId("card-grade-badge")).toHaveText("Graded: 95/100");
      await expect(profCard.getByTestId("feedback-content").locator("strong")).toHaveText("Excellent");
      await expect(profCard.getByTestId("download-submission-link")).toBeVisible();
      await expect(profCard.getByTestId("lock-notice")).toBeVisible();

      // Student views feedback on lesson page
      await studentPage.goto(`/classes/${draftFixture.slug}/lessons/${draftFixture.lessonSlug}`);
      const lessonCard = studentPage.getByTestId("assignment-scratch-react-agent");
      await expect(lessonCard).toBeVisible();
      await expect(lessonCard.getByTestId("lesson-grade-badge")).toHaveText("Graded: 95/100");
      await expect(lessonCard.getByTestId("feedback-content").locator("strong")).toHaveText("Excellent");
      await expect(lessonCard.getByTestId("download-submission-link")).toBeVisible();
      await expect(lessonCard.getByTestId("lock-notice")).toBeVisible();
      await studentPage.close();

      // Regression for duplicate submission: student submitting same URL idempotently returns 200 without deletion
      const duplicateRes = await studentCtx.request.post(
        `/api/classes/${draftFixture.slug}/lessons/${draftFixture.lessonSlug}/submissions`,
        {
          data: {
            assignmentId: "scratch-react-agent",
            fileUrl: created.fileUrl,
            fileName: "notebook.ipynb",
          },
        },
      );
      expect(duplicateRes.status()).toBe(200);
      const dupJson = await duplicateRes.json();
      expect(dupJson.submission.id).toBe(created.id);

      // Verify row in DB is still intact
      const fresh = await prismaLive.notebookSubmission.findUnique({ where: { id: created.id } });
      expect(fresh?.fileUrl).toBe(created.fileUrl);

      // Verify that requesting upload token for already submitted assignment returns 409
      const alreadySubRes = await studentCtx.request.post("/api/blob/upload-submission-token", {
        data: {
          type: "blob.generate-client-token",
          payload: {
            pathname: `classes/${draftFixture.slug}/${draftFixture.lessonSlug}/submissions/${student.userId}/scratch-react-agent/retry.ipynb`,
            clientPayload: JSON.stringify({
              classSlug: draftFixture.slug,
              lessonSlug: draftFixture.lessonSlug,
              assignmentId: "scratch-react-agent",
            }),
            multipart: false,
          },
        },
      });
      expect(alreadySubRes.status()).toBe(409);
      const alreadySubJson = await alreadySubRes.json();
      expect(alreadySubJson.error).toMatch(/already submitted/i);
    } finally {
      if (submissionId) {
        await prismaLive.notebookSubmission.deleteMany({ where: { id: submissionId } });
      }
      await prismaLive.$disconnect();
      await teacher.dispose();
      await teacherCtx.close();
      await student.dispose();
      await studentCtx.close();
      await otherStudent.dispose();
      await otherStudentCtx.close();
      await draftFixture.dispose();
    }
  });

  test("student profile navigation renders Notebooks tab and handles unenrolled state", async ({
    browser,
  }) => {
    const studentCtx = await browser.newContext();
    const student = await signInAs(studentCtx, {
      email: `e2e-nb-student-${process.pid}@example.test`,
      name: "E2E Notebook Student",
    });

    try {
      const page = await studentCtx.newPage();
      await page.goto("/profile");

      // Verify sidebar contains Notebooks tab link
      const nbLink = page.getByRole("link", { name: "📓 Notebooks" });
      await expect(nbLink).toBeVisible();
      await expect(nbLink).toHaveAttribute("href", "/profile?tab=notebooks");

      // Click to navigate to Notebooks tab
      await nbLink.click();
      await expect(page).toHaveURL(/tab=notebooks/);
      await expect(page.getByRole("heading", { name: "Notebooks" })).toBeVisible();
      await expect(page.getByText(/Not enrolled in any classes yet/)).toBeVisible();
      await page.close();
    } finally {
      await student.dispose();
      await studentCtx.close();
    }
  });

  test("lesson page displays homework assignment card with title and status", async ({
    page,
  }) => {
    await page.goto("/classes/building-ai-agents/lessons/l06-production-engineering");
    const asgCard = page.getByTestId("assignment-intro-react-agent");
    await expect(asgCard).toBeVisible();
    await expect(asgCard.getByText("Build a ReAct Agent from Scratch")).toBeVisible();
    await expect(asgCard.getByText("100 pts")).toBeVisible();
    await expect(asgCard.getByText("assignment")).toBeVisible();

    // Unauthenticated user sees sign in prompt
    await expect(asgCard.getByText("Sign in to submit your solution notebook.")).toBeVisible();
  });

  test("NotebookUploader UI: teacher sees notice, student sees dropzone and client-side file validation", async ({
    browser,
  }) => {
    skipUnlessIsolated();
    test.skip(
      !(await checkNotebookSubmissionsTableExists()),
      "NotebookSubmission table is not pushed to this database (run prisma db push to enable)",
    );
    const draftFixture = await draftClass({
      slug: `e2e-mock-ui-${process.pid}`,
      title: `E2E Mock UI ${process.pid}`,
      lesson: "l01-scratch",
      publishForStudents: true,
      homework: {
        due: "2026-10-20T23:59:00Z",
        items: [
          {
            type: "assignment",
            id: "mock-agent",
            title: "Mock ReAct Agent",
            maxScore: 100,
          },
        ],
      },
    });

    const studentCtx = await browser.newContext();
    const student = await signInAs(studentCtx, {
      email: `e2e-mock-student-${process.pid}@example.test`,
      name: "E2E Mock Student",
      classSlug: draftFixture.slug,
    });

    const teacherCtx = await browser.newContext();
    const teacher = await signInAs(teacherCtx, {
      email: `e2e-mock-teacher-${process.pid}@example.test`,
      name: "E2E Mock Teacher",
      classSlug: draftFixture.slug,
      teacher: true,
    });

    try {
      // 1. Teacher views lesson page: must see instructor notice, NOT student uploader
      const teacherPage = await teacherCtx.newPage();
      await teacherPage.goto(`/classes/${draftFixture.slug}/lessons/${draftFixture.lessonSlug}`);
      const teacherCard = teacherPage.getByTestId("assignment-mock-agent");
      await expect(teacherCard).toBeVisible();
      await expect(teacherCard.getByTestId("teacher-assignment-notice")).toBeVisible();
      await expect(teacherCard.getByText("Review submissions in homework matrix →")).toBeVisible();
      await expect(teacherCard.getByTestId("notebook-dropzone")).toHaveCount(0);
      await teacherPage.close();

      // 2. Student views lesson page: sees student uploader dropzone
      const page = await studentCtx.newPage();
      await page.goto(`/classes/${draftFixture.slug}/lessons/${draftFixture.lessonSlug}`);
      const asgCard = page.getByTestId("assignment-mock-agent");
      await expect(asgCard).toBeVisible();
      const dropzone = asgCard.getByTestId("notebook-dropzone");
      await expect(dropzone).toBeVisible();

      // (a) Client validation: reject non-.ipynb file
      const fileInput = asgCard.getByTestId("notebook-file-input");
      await fileInput.setInputFiles({
        name: "test.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("not a notebook"),
      });
      await expect(asgCard.getByTestId("upload-error")).toHaveText(
        "Only Jupyter Notebook (.ipynb) files are accepted.",
      );

      // (b) Valid .ipynb file displays selected file name
      await fileInput.setInputFiles({
        name: "solution.ipynb",
        mimeType: "application/x-ipynb+json",
        buffer: Buffer.from('{"cells":[],"metadata":{}}'),
      });
      await expect(asgCard.getByTestId("selected-file-name")).toHaveText("solution.ipynb");
      const submitBtn = asgCard.getByTestId("submit-notebook-btn");
      await expect(submitBtn).toBeVisible();

      await page.close();
    } finally {
      await student.dispose();
      await studentCtx.close();
      await teacher.dispose();
      await teacherCtx.close();
      await draftFixture.dispose();
    }
  });
});

/* NotebookUploader against mocked network. The only real thing here is the
 * scratch class (published under a unique e2e- slug for the length of a test, so a
 * student can reach its lesson page) and a student enrolled in it. Every call the
 * uploader makes — the submissions GET/POST, the token route and the Blob API — is
 * answered by page.route, so no row and no blob is ever written. */
test.describe("NotebookUploader with mocked network", () => {
  const ASSIGNMENT = "mock-agent";

  // The lesson page renders the uploader only when the table is there; without it
  // it renders the unavailable notice (covered in the last describe).
  test.beforeEach(async () => {
    skipUnlessIsolated();
    test.skip(
      !(await checkNotebookSubmissionsTableExists()),
      "NotebookSubmission table is not pushed to this database (run prisma db push to enable)",
    );
  });

  async function mockedStudent(browser: import("@playwright/test").Browser, tag: string) {
    const fixture = await draftClass({
      slug: `e2e-up-${tag}-${process.pid}`,
      title: `E2E Uploader ${tag} ${process.pid}`,
      lesson: "l01-scratch",
      publishForStudents: true,
      homework: {
        due: "2026-10-20T23:59:00Z",
        items: [{ type: "assignment", id: ASSIGNMENT, title: "Mock Agent", maxScore: 100 }],
      },
    });
    const ctx = await browser.newContext();
    const student = await signInAs(ctx, {
      email: `e2e-up-${tag}-${process.pid}@example.test`,
      name: "E2E Uploader Student",
      classSlug: fixture.slug,
    });
    const submissionsUrl = `**/api/classes/${fixture.slug}/lessons/${fixture.lessonSlug}/submissions`;
    const row = (over: Record<string, unknown> = {}) => ({
      id: "sub-mock",
      userId: student.userId,
      classId: "mock-cls",
      lessonSlug: fixture.lessonSlug,
      assignmentId: ASSIGNMENT,
      fileName: "solution.ipynb",
      fileBytes: 26,
      submittedAt: new Date().toISOString(),
      status: "submitted",
      grade: null,
      maxGrade: 100,
      feedback: null,
      gradedBy: null,
      gradedAt: null,
      ...over,
    });
    return {
      fixture,
      ctx,
      student,
      submissionsUrl,
      row,
      async dispose() {
        await student.dispose();
        await ctx.close();
        await fixture.dispose();
      },
    };
  }

  const NOTEBOOK = {
    name: "solution.ipynb",
    mimeType: "application/x-ipynb+json",
    buffer: Buffer.from('{"cells":[],"metadata":{}}'),
  };

  test("token 409 (masked by the Blob client) is resolved by re-reading the row, then locks", async ({
    browser,
  }) => {
    const m = await mockedStudent(browser, "t409");
    try {
      const page = await m.ctx.newPage();
      let tokenCalls = 0;
      let getCalls = 0;
      await page.route("**/api/blob/upload-submission-token", async (route) => {
        tokenCalls++;
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "assignment already submitted" }),
        });
      });
      await page.route(m.submissionsUrl, async (route) => {
        if (route.request().method() !== "GET") return route.continue();
        getCalls++;
        // Empty when the pre-upload check runs; the row only appears afterwards
        // (another tab won the race), so only the failure path can discover it.
        const submissions =
          getCalls === 1
            ? []
            : [
                m.row({
                  status: "graded",
                  grade: 92,
                  feedback: "Great job on the tools implementation!",
                  gradedBy: "Teacher",
                  gradedAt: new Date().toISOString(),
                }),
              ];
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ submissions }),
        });
      });

      await page.goto(`/classes/${m.fixture.slug}/lessons/${m.fixture.lessonSlug}`);
      const card = page.getByTestId(`assignment-${ASSIGNMENT}`);
      await card.getByTestId("notebook-file-input").setInputFiles(NOTEBOOK);
      await card.getByTestId("submit-notebook-btn").click();

      await expect(card.getByTestId("notebook-uploader-locked")).toBeVisible();
      expect(tokenCalls, "the token route must have been attempted").toBeGreaterThanOrEqual(1);
      expect(getCalls).toBeGreaterThanOrEqual(2);
      await expect(card.getByTestId("grade-badge")).toHaveText("Graded · 92 / 100 pts");
      await expect(card.getByTestId("feedback-content")).toHaveText(
        "Great job on the tools implementation!",
      );
      await expect(card.getByTestId("lock-notice")).toBeVisible();
      await expect(card.getByTestId("notebook-dropzone")).toHaveCount(0);
    } finally {
      await m.dispose();
    }
  });

  test("a failed save is retried against the staged blob: no second upload, same URL, progress shown", async ({
    browser,
  }) => {
    const m = await mockedStudent(browser, "retry");
    try {
      const page = await m.ctx.newPage();
      let tokenCalls = 0;
      let blobPuts = 0;
      const commitBodies: Array<{ fileUrl: string; assignmentId: string }> = [];
      let releaseBlob: () => void = () => {};
      const blobGate = new Promise<void>((resolve) => (releaseBlob = resolve));

      await page.route("**/api/blob/upload-submission-token", async (route) => {
        tokenCalls++;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            type: "blob.generate-client-token",
            clientToken: "vercel_blob_client_mockstore_abcdef",
          }),
        });
      });
      // The Blob API lives on another origin, so the browser preflights it.
      const cors = (route: import("@playwright/test").Route) => ({
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,PUT,POST,OPTIONS",
        "access-control-allow-headers":
          route.request().headers()["access-control-request-headers"] ?? "*",
        "access-control-expose-headers": "*",
      });
      await page.route(/vercel\.com\/api\/blob/, async (route) => {
        if (route.request().method() === "OPTIONS") {
          return route.fulfill({ status: 204, headers: cors(route) });
        }
        blobPuts++;
        const pathname = new URL(route.request().url()).searchParams.get("pathname") ?? "x";
        await blobGate;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: cors(route),
          body: JSON.stringify({
            url: `https://mockstore.private.blob.vercel-storage.com/${pathname}`,
            downloadUrl: `https://mockstore.private.blob.vercel-storage.com/${pathname}?download=1`,
            pathname,
            contentType: "application/x-ipynb+json",
            contentDisposition: "attachment",
          }),
        });
      });
      let posts = 0;
      await page.route(m.submissionsUrl, async (route) => {
        const req = route.request();
        if (req.method() === "GET") {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ submissions: [] }),
          });
        }
        posts++;
        const body = req.postDataJSON();
        commitBodies.push(body);
        if (posts === 1) {
          return route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "database hiccup" }),
          });
        }
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ submission: m.row() }),
        });
      });

      await page.goto(`/classes/${m.fixture.slug}/lessons/${m.fixture.lessonSlug}`);
      const card = page.getByTestId(`assignment-${ASSIGNMENT}`);
      await card.getByTestId("notebook-file-input").setInputFiles(NOTEBOOK);
      await card.getByTestId("submit-notebook-btn").click();

      // Upload is in flight (blob held back): the progress bar is up
      await expect(card.getByTestId("upload-progress")).toBeVisible();
      releaseBlob();

      // The commit fails once; the uploader stays open and offers a retry
      await expect(card.getByTestId("upload-error")).toContainText("database hiccup");
      expect(blobPuts).toBe(1);
      expect(posts).toBe(1);

      // Retry with the same file selected
      await card.getByTestId("submit-notebook-btn").click();
      await expect(card.getByTestId("notebook-uploader-locked")).toBeVisible();

      expect(blobPuts, "retry must reuse the staged blob").toBe(1);
      expect(tokenCalls, "retry must not ask for a second token").toBe(1);
      expect(posts).toBe(2);
      expect(commitBodies[1].fileUrl).toBe(commitBodies[0].fileUrl);
      expect(commitBodies[0].fileUrl).toContain(
        `classes/${m.fixture.slug}/${m.fixture.lessonSlug}/submissions/${m.student.userId}/${ASSIGNMENT}/`,
      );
    } finally {
      await m.dispose();
    }
  });

  test("503 from the submissions route shows the unavailable notice instead of a dead dropzone", async ({
    browser,
  }) => {
    const m = await mockedStudent(browser, "u503");
    try {
      const page = await m.ctx.newPage();
      let tokenCalls = 0;
      await page.route("**/api/blob/upload-submission-token", async (route) => {
        tokenCalls++;
        await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
      });
      await page.route(m.submissionsUrl, async (route) => {
        if (route.request().method() !== "GET") return route.continue();
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "not enabled", unavailable: true, submissions: [] }),
        });
      });

      await page.goto(`/classes/${m.fixture.slug}/lessons/${m.fixture.lessonSlug}`);
      const card = page.getByTestId(`assignment-${ASSIGNMENT}`);
      await card.getByTestId("notebook-file-input").setInputFiles(NOTEBOOK);
      await card.getByTestId("submit-notebook-btn").click();

      await expect(card.getByTestId("uploader-unavailable")).toBeVisible();
      await expect(card.getByTestId("notebook-dropzone")).toHaveCount(0);
      expect(tokenCalls, "nothing is uploaded when the table is missing").toBe(0);
    } finally {
      await m.dispose();
    }
  });

  test("Clear drops the staged file and error", async ({ browser }) => {
    const m = await mockedStudent(browser, "clear");
    try {
      const page = await m.ctx.newPage();
      await page.goto(`/classes/${m.fixture.slug}/lessons/${m.fixture.lessonSlug}`);
      const card = page.getByTestId(`assignment-${ASSIGNMENT}`);
      await card.getByTestId("notebook-file-input").setInputFiles(NOTEBOOK);
      await expect(card.getByTestId("selected-file-name")).toHaveText("solution.ipynb");
      await card.getByTestId("clear-notebook-btn").click();
      await expect(card.getByTestId("selected-file-name")).toHaveCount(0);
      await expect(card.getByTestId("submit-notebook-btn")).toHaveCount(0);
    } finally {
      await m.dispose();
    }
  });
});

test.describe("Homework overview without the NotebookSubmission table", () => {
  test("assignments are flagged unavailable, not counted as not handed in", async ({
    browser,
  }) => {
    skipUnlessIsolated();
    const tableExists = await checkNotebookSubmissionsTableExists();
    test.skip(
      tableExists,
      "NotebookSubmission table exists in this database, so the table-missing path cannot be reached",
    );

    const fixture = await draftClass({
      slug: `e2e-hw-unavail-${process.pid}`,
      title: `E2E HW Unavailable ${process.pid}`,
      lesson: "l01-scratch",
      publishForStudents: true,
      homework: {
        due: "2026-10-20T23:59:00Z",
        items: [{ type: "assignment", id: "hw-a", title: "Assignment A", maxScore: 100 }],
      },
    });
    const teacherCtx = await browser.newContext();
    const teacher = await signInAs(teacherCtx, {
      email: `e2e-hwu-teacher-${process.pid}@example.test`,
      name: "E2E HWU Teacher",
      classSlug: fixture.slug,
      teacher: true,
    });
    const studentCtx = await browser.newContext();
    const student = await signInAs(studentCtx, {
      email: `e2e-hwu-student-${process.pid}@example.test`,
      name: "E2E HWU Student",
      classSlug: fixture.slug,
    });
    try {
      const page = await teacherCtx.newPage();
      const overview = await page.goto(`/classes/${fixture.slug}/homework?tab=homework`);
      expect(overview?.status()).toBe(200);
      await expect(page.getByTestId("submissions-unavailable-notice")).toBeVisible();
      const cell = page.getByTestId(`hw-unavailable-${fixture.lessonSlug}`);
      await expect(cell).toBeVisible();
      await expect(cell).not.toHaveText("0/1");

      const focused = await page.goto(
        `/classes/${fixture.slug}/homework?lesson=${fixture.lessonSlug}`,
      );
      expect(focused?.status()).toBe(200);
      await expect(page.getByTestId("submissions-unavailable-notice")).toBeVisible();
      // The enrolled student gets the same answer: no dead dropzone, no fake "not submitted"
      const studentPage = await studentCtx.newPage();
      await studentPage.goto(`/classes/${fixture.slug}/lessons/${fixture.lessonSlug}`);
      const card = studentPage.getByTestId("assignment-hw-a");
      await expect(card.getByTestId("lesson-status-badge")).toHaveText("Submissions Unavailable");
      await expect(card.getByTestId("notebook-dropzone")).toHaveCount(0);
      await studentPage.close();
      await page.close();
    } finally {
      await student.dispose();
      await studentCtx.close();
      await teacher.dispose();
      await teacherCtx.close();
      await fixture.dispose();
    }
  });
});
