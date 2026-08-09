/* Sign a test user in without going through OAuth.
 *
 * Auth.js is configured with database sessions here, so a session *is* a row in
 * Session plus a cookie holding its token — no JWT to forge. That makes the
 * member-only class pages testable, which is otherwise impossible: Google and
 * GitHub cannot be driven from a test.
 *
 * Everything created is torn down by dispose(), so a failed run does not leave a
 * ghost student in a class roster.
 */
import fs from "node:fs";
import path from "node:path";
import type { BrowserContext } from "@playwright/test";

// CI exports DATABASE_URL; locally it lives in .env.local, which Playwright does
// not load (only `next start` does), so fall back to reading it directly.
function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const file = path.join(__dirname, "..", "..", "..", ".env.local");
  const line = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .find((l) => l.trim().startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL not found in env or .env.local");
  return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

export type TestSession = {
  userId: string;
  /** Mark a problem solved for this user, as the in-browser runner would. */
  solveProblem: (problemId: string) => Promise<void>;
  /** Record a delivered lesson with a published PDF, as "Finish lesson" would.
   * Requires signInAs to have been given a classSlug. */
  publishLessonPdf: (lessonSlug: string, url: string, bytes?: number) => Promise<void>;
  dispose: () => Promise<void>;
};

/** Guard rail with teeth: DATABASE_URL here is a real database that real people
 * use, and dispose() deletes the user it signed in. Only synthetic addresses are
 * allowed, and only a user this helper created is ever deleted. */
const TEST_EMAIL = /@example\.test$/;

export async function signInAs(
  context: BrowserContext,
  opts: { email: string; name: string; classSlug?: string },
): Promise<TestSession> {
  if (!TEST_EMAIL.test(opts.email)) {
    throw new Error(
      `signInAs refuses ${opts.email}: use a @example.test address. This helper ` +
        `deletes the account it signs in, and .env.local points at the real database.`,
    );
  }

  // Imported lazily so specs that never authenticate don't pay for the client.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl() });

  let classId: string | null = null;
  const lessonSessionIds: string[] = [];

  const existing = await prisma.user.findUnique({ where: { email: opts.email } });
  const user =
    existing ??
    (await prisma.user.create({ data: { email: opts.email, name: opts.name } }));
  const created = !existing;

  if (opts.classSlug) {
    // CI runs against an empty database (`prisma db push`, no seed step), so
    // create the row rather than depending on `pnpm db:sync-classes` having run.
    const cls = await prisma.class.upsert({
      where: { slug: opts.classSlug },
      create: {
        slug: opts.classSlug,
        title: opts.classSlug,
        inviteCode: `E2E${process.pid}`.slice(0, 10),
        teacherEmails: [],
      },
      update: {},
    });
    classId = cls.id;
    await prisma.classEnrollment.upsert({
      where: { classId_userId: { classId: cls.id, userId: user.id } },
      create: { classId: cls.id, userId: user.id },
      update: {},
    });
  }

  const sessionToken = `e2e-${user.id}-${process.pid}`;
  await prisma.session.upsert({
    where: { sessionToken },
    create: {
      sessionToken,
      userId: user.id,
      expires: new Date(Date.now() + 60 * 60 * 1000),
    },
    update: { expires: new Date(Date.now() + 60 * 60 * 1000) },
  });

  // Plain http on localhost, so Auth.js uses the unprefixed cookie name.
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  return {
    userId: user.id,
    async solveProblem(problemId: string) {
      // Progress rows point at Problem, which only exists once
      // `db:sync-problems` has run — not the case on a fresh CI database.
      const [topic, slug] = problemId.split("/");
      await prisma.problem.upsert({
        where: { id: problemId },
        create: {
          id: problemId, topic, slug, title: slug,
          difficulty: "easy", contentHash: "e2e",
        },
        update: {},
      });
      await prisma.userProblemProgress.upsert({
        where: { userId_problemId: { userId: user.id, problemId } },
        create: { userId: user.id, problemId, clientSolved: true },
        update: { clientSolved: true },
      });
    },
    async publishLessonPdf(lessonSlug: string, url: string, bytes = 4_900_000) {
      if (!classId) throw new Error("publishLessonPdf needs signInAs({classSlug})");
      const row = await prisma.lessonSession.create({
        data: {
          classId,
          lessonSlug,
          deckHash: "e2e",
          endedAt: new Date(),
          pdfUrl: url,
          pdfBytes: bytes,
        },
      });
      lessonSessionIds.push(row.id);
    },
    async dispose() {
      // Cascades from User would do most of this, but be explicit: a stray
      // enrollment would show up in the teacher's roster on the real site, and a
      // stray lesson session would put a dead PDF link on a real lesson page.
      if (lessonSessionIds.length) {
        await prisma.lessonSession.deleteMany({ where: { id: { in: lessonSessionIds } } });
      }
      await prisma.userProblemProgress.deleteMany({ where: { userId: user.id } });
      await prisma.classEnrollment.deleteMany({ where: { userId: user.id } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      if (created) await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      await prisma.$disconnect();
    },
  };
}
