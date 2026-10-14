import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getManifest } from "@/lib/content";
import { flatten, myClassSlugs, visibleClasses } from "@/lib/classes";
import {
  effectiveMaxScore,
  extractLessonAssignments,
  formatDate,
  type EnrolledAssignment,
  type NotebookSubmissionData,
} from "@/lib/classes-shared";
import { renderFeedbackMarkdown } from "@/lib/feedback-render";
import { JoinClassForm } from "@/components/JoinClassForm";
import { ProfileNameForm } from "@/components/ProfileNameForm";
import { NotebookUploader } from "@/components/NotebookUploader";
import { splitName } from "@/lib/person";
import { visibleProblems } from "@/lib/problem";
import { computeStreak } from "@/lib/stats";
import { ProfileNav } from "./ProfileNav";

export const metadata = { title: "Profile — ML Practice" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; saved?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <section>
        <h1>Profile</h1>
        <p className="muted">Sign in to track your progress.</p>
      </section>
    );
  }

  const { tab = "submissions", saved } = await searchParams;
  const userId = session.user.id;

  const [solvedCount, streak, manifest] = await Promise.all([
    prisma.userProblemProgress.count({ where: { userId, clientSolved: true } }),
    computeStreak(userId),
    getManifest(),
  ]);
  const total = visibleProblems(manifest).length;

  return (
    <div className="profile-layout">
      <ProfileNav
        activeTab={tab}
        name={session.user.name ?? null}
        email={session.user.email ?? null}
        streak={streak}
        solvedCount={solvedCount}
        totalCount={total}
      />

      <section>
        {tab === "favorites" ? (
          <FavoritesTab userId={userId} manifest={manifest} />
        ) : tab === "classes" ? (
          <ClassesTab />
        ) : tab === "account" ? (
          <AccountTab userId={userId} saved={saved === "1"} />
        ) : tab === "notebooks" ? (
          <NotebooksTab userId={userId} />
        ) : (
          <SubmissionsTab userId={userId} />
        )}
      </section>
    </div>
  );
}

async function AccountTab({ userId, saved }: { userId: string; saved: boolean }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, firstName: true, lastName: true, email: true },
  });
  const { first, last } = splitName(user ?? {});

  return (
    <>
      <h2>Account</h2>
      <p className="muted">
        Your name is what your teacher sees next to your homework.
      </p>
      {saved && <p className="result-good" data-testid="account-saved">Saved.</p>}
      <ProfileNameForm first={first} last={last} email={user?.email ?? null} />
    </>
  );
}

async function ClassesTab() {
  // visibleClasses(), not getClasses(): a class you were enrolled in and that is
  // back in draft would otherwise sit here as a link to a 404.
  const [all, mine] = await Promise.all([visibleClasses(), myClassSlugs()]);
  const member = new Set(mine.member);
  const teaching = new Set(mine.teaching);
  const joined = all.filter((c) => member.has(c.slug));

  return (
    <>
      <h2>Classes</h2>
      {joined.length === 0 ? (
        <p className="muted">
          Not in a group yet. Every class under <Link href="/classes">Classes</Link>{" "}
          is open to read; enter your teacher&rsquo;s group code on the class page
          to have your homework counted.
        </p>
      ) : (
        <ul className="problem-list">
          {joined.map((cls) => {
            const hwTotal = cls.lessons.reduce(
              (n, l) => n + flatten(l.homework?.items ?? []).length,
              0,
            );
            return (
              <li key={cls.slug}>
                <Link href={`/classes/${cls.slug}`} className="problem-card">
                  <span className="title">{cls.title}</span>
                  <span className="meta">
                    {teaching.has(cls.slug) && <span className="badge hard">teacher</span>}
                    <span className="badge easy">{cls.lessons.length} lessons</span>
                    {hwTotal > 0 && (
                      <span className="badge medium">{hwTotal} homework tasks</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <JoinClassForm />
    </>
  );
}

async function NotebooksTab({ userId }: { userId: string }) {
  const [all, mine] = await Promise.all([visibleClasses(), myClassSlugs()]);
  const teaching = new Set(mine.teaching);
  const studentSlugs = new Set(mine.member.filter((slug) => !teaching.has(slug)));
  const enrolledClasses = all.filter((c) => studentSlugs.has(c.slug));

  if (enrolledClasses.length === 0) {
    return (
      <>
        <h2>Notebooks</h2>
        {teaching.size > 0 ? (
          <p className="muted">
            You are an instructor in {teaching.size} class{teaching.size > 1 ? "es" : ""}. To review and grade student notebook submissions, visit the{" "}
            <Link href={`/classes/${mine.teaching[0]}/homework`}>Homework Matrix</Link>.
          </p>
        ) : (
          <p className="muted">
            Not enrolled in any classes yet. Join a class with your teacher&rsquo;s group code
            to submit notebooks and receive grades.
          </p>
        )}
        <JoinClassForm />
      </>
    );
  }

  const assignments: EnrolledAssignment[] = [];
  for (const cls of enrolledClasses) {
    for (const lesson of cls.lessons) {
      assignments.push(...extractLessonAssignments(lesson, cls));
    }
  }

  if (assignments.length === 0) {
    return (
      <>
        <h2>Notebooks</h2>
        <p className="muted">
          No notebook assignments in your enrolled classes yet.
        </p>
      </>
    );
  }

  const classRows = await prisma.class.findMany({
    where: { slug: { in: enrolledClasses.map((c) => c.slug) } },
    select: { id: true, slug: true },
  });
  const classIdBySlug = new Map(classRows.map((c) => [c.slug, c.id]));
  const classIds = Array.from(new Set(classRows.map((c) => c.id)));

  let submissionsUnavailable = false;
  const submissions =
    classIds.length > 0
      ? await prisma.notebookSubmission
          .findMany({
            where: {
              userId,
              classId: { in: classIds },
            },
          })
          .catch((err) => {
            if (err?.code === "P2021") {
              submissionsUnavailable = true;
              return [];
            }
            throw err;
          })
      : [];

  const subMap = new Map<string, NotebookSubmissionData>();
  for (const s of submissions) {
    subMap.set(`${s.classId}:${s.lessonSlug}:${s.assignmentId}`, {
      id: s.id,
      userId: s.userId,
      classId: s.classId,
      lessonSlug: s.lessonSlug,
      assignmentId: s.assignmentId,
      fileUrl: s.fileUrl,
      fileName: s.fileName,
      fileBytes: s.fileBytes,
      submittedAt: s.submittedAt.toISOString(),
      status: s.status,
      grade: s.grade,
      maxGrade: s.maxGrade,
      feedback: s.feedback,
      gradedBy: s.gradedBy,
      gradedAt: s.gradedAt ? s.gradedAt.toISOString() : null,
    });
  }

  return (
    <>
      <h2>Notebooks</h2>
      <p className="muted">
        Your Jupyter Notebook assignments, submission progress, and teacher feedback.
      </p>
      <div className="notebook-assignment-list" data-testid="notebook-assignment-list">
        {assignments.map((item) => {
          const classId = classIdBySlug.get(item.classSlug) ?? "";
          const sub = classId
            ? subMap.get(`${classId}:${item.lessonSlug}:${item.assignment.id}`) ?? null
            : null;
          const renderedFeedback = sub?.feedback ? renderFeedbackMarkdown(sub.feedback) : null;
          const maxScore = effectiveMaxScore(item.assignment.maxScore, sub?.maxGrade);

          return (
            <div
              key={`${item.classSlug}:${item.lessonSlug}:${item.assignment.id}`}
              className="notebook-assignment-card"
              data-testid={`assignment-card-${item.assignment.id}`}
            >
              <div className="notebook-card-header">
                <div>
                  <Link
                    href={`/classes/${item.classSlug}/lessons/${item.lessonSlug}`}
                    className="muted notebook-card-lesson-link"
                  >
                    {item.classTitle} › {item.lessonTitle}
                  </Link>
                  <h3 className="notebook-card-title">{item.assignment.title}</h3>
                </div>
                <div className="notebook-card-badges">
                  {item.assignment.maxScore && (
                    <span className="muted" style={{ fontSize: "0.85rem" }}>
                      {item.assignment.maxScore} pts ·{" "}
                    </span>
                  )}
                  <span className={`badge ${item.isHomework ? "medium" : "easy"}`}>
                    {item.isHomework ? "homework" : "practice"}
                  </span>
                  {submissionsUnavailable ? (
                    <span className="badge muted" data-testid="card-status-badge">
                      Submissions Unavailable
                    </span>
                  ) : sub?.status === "graded" && sub.grade !== null ? (
                    <span className="badge easy" data-testid="card-grade-badge">
                      Graded: {sub.grade}/{maxScore}
                    </span>
                  ) : sub ? (
                    <span className="badge medium" data-testid="card-status-badge">
                      Submitted · Awaiting Review
                    </span>
                  ) : (
                    <span className="badge hw-sub-none" data-testid="card-status-badge">
                      Not Submitted
                    </span>
                  )}
                </div>
              </div>

              <div className="notebook-card-body">
                {item.isHomework && item.due && (
                  <p className="muted" style={{ fontSize: "0.82rem", margin: "0.25rem 0 0.5rem" }}>
                    Due: {formatDate(item.due)}
                  </p>
                )}

                {item.assignment.templateHref && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <a
                      href={item.assignment.templateHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bt-clear-btn"
                      style={{ fontSize: "0.82rem" }}
                      data-testid="template-link"
                    >
                      Open starter notebook (Colab) ↗
                    </a>
                  </div>
                )}

                {submissionsUnavailable ? (
                  <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
                    Notebook submissions are currently unavailable on this deployment.
                  </p>
                ) : (
                  <NotebookUploader
                    classSlug={item.classSlug}
                    lessonSlug={item.lessonSlug}
                    assignmentId={item.assignment.id}
                    userId={userId}
                    initialSubmission={sub}
                    maxScore={item.assignment.maxScore}
                    renderedFeedbackHtml={renderedFeedback}
                    submissionsUnavailable={submissionsUnavailable}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

async function SubmissionsTab({ userId }: { userId: string }) {
  const submissions = await prisma.submission.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { problem: { select: { title: true, topic: true, slug: true } } },
  });

  return (
    <>
      <h2>Submissions</h2>
      {submissions.length === 0 ? (
        <p className="muted">No submissions yet — go solve something!</p>
      ) : (
        <ul className="problem-list">
          {submissions.map((s) => {
            const ok = s.total > 0 && s.passed === s.total;
            return (
              <li key={s.id}>
                <Link
                  href={`/problems/${s.problem.topic}/${s.problem.slug}?submission=${s.id}`}
                  className="problem-card"
                >
                  <span className="title">{s.problem.title}</span>
                  <span className="meta">
                    <span className={ok ? "result-good" : "result-bad"}>
                      {s.passed}/{s.total}
                    </span>
                    <span className="topic-tag">
                      {new Date(s.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

async function FavoritesTab({
  userId,
  manifest,
}: {
  userId: string;
  manifest: Awaited<ReturnType<typeof getManifest>>;
}) {
  const favs = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { problem: { select: { title: true, topic: true, slug: true, difficulty: true } } },
  });

  return (
    <>
      <h2>Favorites</h2>
      {favs.length === 0 ? (
        <p className="muted">
          No favorites yet — click ★ on any problem to save it here.
        </p>
      ) : (
        <ul className="problem-list">
          {favs.map((f) => (
            <li key={f.id}>
              <Link
                href={`/problems/${f.problem.topic}/${f.problem.slug}`}
                className="problem-card"
              >
                <span className="title">{f.problem.title}</span>
                <span className="meta">
                  <span className={`badge ${f.problem.difficulty}`}>
                    {f.problem.difficulty}
                  </span>
                  <span className="topic-tag">{f.problem.topic}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
