import { test, expect } from "@playwright/test";

import {
  PUBLISH_SKIP_REASON,
  draftClass,
  isIsolatedDb,
  signInAs,
} from "./support/session";

const SAMPLE_DEBATE = {
  id: "debate-1",
  title: "Regulate & Slow Down vs. Open Velocity",
  motion: "Frontier AI development should be actively slowed down.",
  teams: [
    {
      id: "openness-velocity",
      name: "Team 1 — For Openness and Velocity",
      members: ["Mariia Fadeeva", "Nikita Fadeev", "Kamaliia Alisheva"],
    },
    {
      id: "regulation",
      name: "Team 2 — For Regulation",
      members: ["Dmitrii Kondratev", "Artem Grigorash", "Daniil Levtsov"],
    },
  ],
};

test("debate poll: teacher opens/closes/resets, members vote live, voter list stays teacher-only", async ({
  browser,
}) => {
  test.skip(!isIsolatedDb(), PUBLISH_SKIP_REASON);

  const slug = `e2e-debate-${process.pid}`;
  const lessonSlug = "l08-debate-1";
  const cls = await draftClass({
    slug,
    title: `E2E Debate Class ${process.pid}`,
    lesson: lessonSlug,
    deck: null,
    debates: [SAMPLE_DEBATE],
    publishForStudents: true,
  });

  const teacherCtx = await browser.newContext();
  const s1Ctx = await browser.newContext();
  const s2Ctx = await browser.newContext();
  const outsiderCtx = await browser.newContext();

  const teacher = await signInAs(teacherCtx, {
    email: `e2e-debate-teacher-${process.pid}@example.test`,
    name: "Debate Teacher",
    classSlug: slug,
    teacher: true,
  });
  const s1 = await signInAs(s1Ctx, {
    email: `e2e-debate-s1-${process.pid}@example.test`,
    name: "Alice Voter",
    classSlug: slug,
  });
  const s2 = await signInAs(s2Ctx, {
    email: `e2e-debate-s2-${process.pid}@example.test`,
    name: "Bob Voter",
    classSlug: slug,
  });
  const outsider = await signInAs(outsiderCtx, {
    email: `e2e-debate-out-${process.pid}@example.test`,
    name: "Not Enrolled",
  });

  try {
    const lessonUrl = `/classes/${slug}/lessons/${lessonSlug}`;
    const apiBase = `/api/classes/${slug}/lessons/${lessonSlug}/debates`;

    const teacherPage = await teacherCtx.newPage();
    const s1Page = await s1Ctx.newPage();
    const s2Page = await s2Ctx.newPage();

    // Slide-less debate lesson renders the poll and hides slide buttons.
    await teacherPage.goto(lessonUrl);
    await expect(teacherPage.getByRole("link", { name: "Open slides" })).toHaveCount(0);
    await expect(teacherPage.getByTestId("debate-status-debate-1")).toHaveText("Not open yet");
    await expect(teacherPage.getByText("Mariia Fadeeva")).toBeVisible();
    await expect(teacherPage.getByText("Dmitrii Kondratev")).toBeVisible();

    // Voting before the teacher opens the poll is rejected with 409.
    const earlyVote = await s1Ctx.request.post(`${apiBase}/debate-1/vote`, {
      data: { teamId: "openness-velocity" },
    });
    expect(earlyVote.status()).toBe(409);

    // Teacher opens voting.
    await teacherPage.getByTestId("debate-open-debate-1").click();
    await expect(teacherPage.getByTestId("debate-status-debate-1")).toHaveText(
      "Live · Voting open",
    );

    // Non-member cannot vote (403) and student cannot toggle state (403).
    const outsiderVote = await outsiderCtx.request.post(`${apiBase}/debate-1/vote`, {
      data: { teamId: "openness-velocity" },
    });
    expect(outsiderVote.status()).toBe(403);

    const studentState = await s1Ctx.request.post(`${apiBase}/debate-1/state`, {
      data: { action: "close" },
    });
    expect(studentState.status()).toBe(403);

    // Student 1 votes for Team 1; Student 2 votes for Team 2.
    await s1Page.goto(lessonUrl);
    await s1Page.getByTestId("debate-vote-debate-1-openness-velocity").click();
    await expect(s1Page.getByTestId("debate-votes-debate-1-openness-velocity")).toContainText("1");
    await expect(s1Page.getByTestId("debate-pct-debate-1-openness-velocity")).toHaveText("100%");

    await s2Page.goto(lessonUrl);
    await s2Page.getByTestId("debate-vote-debate-1-regulation").click();
    await expect(s2Page.getByTestId("debate-total-debate-1")).toHaveText("2 votes");
    await expect(s2Page.getByTestId("debate-pct-debate-1-regulation")).toHaveText("50%");

    // Student 1 switches vote to Team 2.
    await s1Page.getByTestId("debate-vote-debate-1-regulation").click();
    await expect(s1Page.getByTestId("debate-votes-debate-1-openness-velocity")).toContainText("0");
    await expect(s1Page.getByTestId("debate-votes-debate-1-regulation")).toContainText("2");
    await expect(s1Page.getByTestId("debate-pct-debate-1-regulation")).toHaveText("100%");

    // Student API response must never expose voter names.
    const studentJson = await (await s1Ctx.request.get(apiBase)).json();
    expect(studentJson.polls[0].voters).toBeUndefined();
    expect(studentJson.polls[0].myVote).toBe("regulation");

    // Teacher sees live voter breakdown and closes the poll.
    await teacherPage.reload();
    const votersDetails = teacherPage.getByTestId("debate-voters-debate-1");
    await votersDetails.locator("summary").click();
    await expect(votersDetails).toContainText("Alice Voter");
    await expect(votersDetails).toContainText("Bob Voter");

    await teacherPage.getByTestId("debate-close-debate-1").click();
    await expect(teacherPage.getByTestId("debate-status-debate-1")).toHaveText("Voting closed");
    await expect(
      teacherPage.getByTestId("debate-team-debate-1-regulation").getByText("Winner"),
    ).toBeVisible();

    // Closed poll refuses further votes.
    const lateVote = await s1Ctx.request.post(`${apiBase}/debate-1/vote`, {
      data: { teamId: "openness-velocity" },
    });
    expect(lateVote.status()).toBe(409);

    // Teacher resets votes (accept confirmation dialog).
    teacherPage.once("dialog", (d) => d.accept());
    await teacherPage.getByTestId("debate-reset-debate-1").click();
    await expect(teacherPage.getByTestId("debate-total-debate-1")).toHaveText("0 votes");
    await expect(teacherPage.getByTestId("debate-status-debate-1")).toHaveText("Not open yet");
  } finally {
    await teacherCtx.close();
    await s1Ctx.close();
    await s2Ctx.close();
    await outsiderCtx.close();
    await outsider.dispose();
    await s2.dispose();
    await s1.dispose();
    await teacher.dispose();
    await cls.dispose();
  }
});
