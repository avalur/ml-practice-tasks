import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import {
  allRefs,
  classInvites,
  classStudents,
  codePrefix,
  findLesson,
  formatDay,
  getAccess,
  getClassMeta,
  getClasses,
  isAssignment,
  isDone,
  lessonMatrixItems,
  solvedKeys,
  type SolvedKeysResult,
  type TrackableRef,
} from "@/lib/classes";
import { findNotebookSubmissions, toSubmissionData } from "@/lib/notebook-submissions";
import { gradingQueue } from "@/lib/teaching";
import { InviteCodes } from "@/components/InviteCodes";
import { AttendanceBatchButtons } from "@/components/AttendanceBatchButtons";
import { LessonHomeworkTable } from "@/components/LessonHomeworkTable";
import type { SubmissionModalData } from "@/components/SubmissionReviewModal";
import { ClassTeacherNav, type TeacherTab } from "@/components/ClassTeacherNav";
import { GradingList } from "@/components/GradingList";
import { EmptyState, Notice, PageHeader } from "@/components/ui";
import { AttendanceMatrix } from "./AttendanceMatrix";
import { HomeworkMatrix } from "./HomeworkMatrix";

type Params = { slug: string };
type Search = { lesson?: string; tab?: string };

export const metadata: Metadata = {
  title: "Homework & attendance — ML Practice",
  robots: { index: false },
};

const TABS = ["homework", "attendance", "groups", "grading"] as const;
const GRADING_LIMIT = 500;
type Tab = (typeof TABS)[number];

export default async function HomeworkPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const { lesson: focusSlug, tab: rawTab } = await searchParams;
  const cls = await getClassMeta(slug);
  if (!cls) notFound();

  const access = await getAccess(slug);
  if (!access.classRow) notFound();
  if (!access.isTeacher) notFound();
  const classId = access.classRow.id;

  const withHomework = cls.lessons.filter((l) => (l.homework?.items.length ?? 0) > 0);
  const focus = focusSlug ? findLesson(cls, focusSlug) : null;
  const tab: Tab = focus
    ? "homework"
    : TABS.includes(rawTab as Tab)
      ? (rawTab as Tab)
      : withHomework.length > 0
        ? "homework"
        : "attendance";

  // Students only: everyone who typed a group code. Teachers are in the
  // enrollment table too (so they show up in their own live monitor), but they
  // are not a row of the homework table.
  const [roster, invites, attendances] = await Promise.all([
    classStudents(classId),
    classInvites(classId),
    prisma.lessonAttendance.findMany({
      where: { classId, attended: true },
      select: { lessonSlug: true, userId: true },
    }),
  ]);
  const ids = roster.map((m) => m.id);
  const solved: SolvedKeysResult =
    tab === "homework" ? await solvedKeys(ids, allRefs(cls), { classId }) : new Set<string>();
  // The NotebookSubmission table is not pushed yet: assignments cannot be told
  // apart from "nobody handed it in", so they are left out of every count below
  // and flagged, instead of reading as a class that all failed.
  let submissionsUnavailable = Boolean(solved.unavailable);
  const done = (userId: string, r: TrackableRef, lessonSlug: string) =>
    isDone(solved, userId, r, { classId, lessonSlug });

  const header = (
    <>
      <p className="muted class-breadcrumb">
        <Link href="/teach">Teaching</Link> › <Link href={`/classes/${slug}`}>{cls.title}</Link>
      </p>
      <PageHeader
        title={cls.title}
        subtitle={`${roster.length} student${roster.length === 1 ? "" : "s"} in ${invites.length} group${invites.length === 1 ? "" : "s"}`}
      />
      <ClassTeacherNav
        slug={slug}
        classId={classId}
        studio={access.studio}
        current={tab as TeacherTab}
      />
    </>
  );

  if (tab === "groups") {
    return (
      <article>
        {header}
        <InviteCodes slug={slug} prefix={codePrefix(slug)} invites={invites} />
      </article>
    );
  }

  if (tab === "grading") {
    // Two queries, not one list split in two: a cap on a mixed list would let
    // recent grades push an old ungraded notebook out of sight.
    const metas = new Map((await getClasses()).map((c) => [c.slug, c]));
    const [pendingQ, gradedQ] = await Promise.all([
      gradingQueue([{ id: classId, slug }], metas, { status: "submitted", take: GRADING_LIMIT }),
      gradingQueue([{ id: classId, slug }], metas, { status: "graded", take: 50 }),
    ]);
    const unavailable = pendingQ.unavailable || gradedQ.unavailable;
    const pending = pendingQ.items;
    const graded = gradedQ.items;
    return (
      <article>
        {header}
        {unavailable && (
          <Notice tone="warning" testId="submissions-unavailable-notice">
            Notebook submissions are unavailable (database table not migrated yet) — run{" "}
            <code>pnpm db:push</code>.
          </Notice>
        )}
        <h2 className="tab-section-title">Waiting for a grade</h2>
        {pending.length >= GRADING_LIMIT && (
          <Notice tone="warning">
            Showing the {GRADING_LIMIT} oldest of the notebooks waiting; the rest appear as these
            are graded.
          </Notice>
        )}
        <GradingList
          items={pending}
          showClass={false}
          empty="Every submitted notebook has been graded."
          testId="grading-pending"
        />
        {graded.length > 0 && (
          <>
            <h2 className="tab-section-title">Recently graded</h2>
            <GradingList items={graded} showClass={false} empty="" testId="grading-done" />
          </>
        )}
      </article>
    );
  }

  const noStudents =
    roster.length === 0 ? (
      <EmptyState
        title={invites.length === 0 ? "No group codes yet" : "Nobody has entered a code yet"}
        action={
          <Link className="btn small primary" href={`/classes/${slug}/homework?tab=groups`}>
            {invites.length === 0 ? "Make a group code" : "See the codes"}
          </Link>
        }
      >
        Students appear here once they join a group with the code you read out to the room.
      </EmptyState>
    ) : null;

  if (tab === "attendance") {
    return (
      <article>
        {header}
        {noStudents ?? (
          <AttendanceMatrix
            slug={slug}
            lessons={cls.lessons}
            roster={roster}
            attended={new Set(attendances.map((a) => `${a.lessonSlug}|${a.userId}`))}
          />
        )}
      </article>
    );
  }

  // --- homework: the overview matrix, or one lesson in detail -------------
  const lessonItems = focus ? lessonMatrixItems(focus) : [];
  let initialSubmissions: SubmissionModalData[] = [];
  // Query NotebookSubmission only when this lesson declares an assignment —
  // the same guard solvedKeys uses. Classes without assignments keep working
  // before `pnpm db:push` has created the table; lessons that do declare them
  // show the unavailable banner instead.
  if (focus && !submissionsUnavailable && lessonItems.some(isAssignment)) {
    const { rows, unavailable } = await findNotebookSubmissions({
      where: { classId, lessonSlug: focus.slug },
    });
    submissionsUnavailable ||= unavailable;
    initialSubmissions = rows.map((r) => ({ ...toSubmissionData(r), fileUrl: r.fileUrl }));
  }
  const matrixItems = submissionsUnavailable
    ? lessonItems.filter((i) => !isAssignment(i))
    : lessonItems;

  return (
    <article>
      {header}
      {submissionsUnavailable && (
        <Notice tone="warning" testId="submissions-unavailable-notice">
          Notebook submissions are unavailable (database table not migrated yet), so assignment
          columns are not counted below — run <code>pnpm db:push</code>.
        </Notice>
      )}

      {noStudents ??
        (focus ? (
          <>
            <p className="muted">
              <Link href={`/classes/${slug}/homework?tab=homework`}>← all lessons</Link>
            </p>
            <div className="hw-lesson-header">
              <div>
                <h2>{focus.title}</h2>
                <p className="muted">
                  {focus.date ? formatDay(focus.date, { year: true }) : ""}
                  {focus.homework ? ` · due ${formatDay(focus.homework.due, { year: true })}` : ""}
                </p>
              </div>
              <AttendanceBatchButtons classSlug={slug} lessonSlug={focus.slug} userIds={ids} />
            </div>
            <LessonHomeworkTable
              classSlug={slug}
              lessonSlug={focus.slug}
              roster={roster}
              items={matrixItems}
              initialSubmissions={initialSubmissions}
              solvedKeys={Array.from(solved)}
              classId={classId}
              due={focus.homework?.due ?? null}
              attendedUserIds={attendances
                .filter((a) => a.lessonSlug === focus.slug)
                .map((a) => a.userId)}
              teacherEmail={access.email ?? null}
            />
          </>
        ) : withHomework.length === 0 ? (
          <EmptyState title="No homework in this class">
            Lessons with homework show up here as columns. Open a lesson from the{" "}
            <Link href={`/classes/${slug}/homework?tab=attendance`}>attendance</Link> view to see
            its in-class practice per student.
          </EmptyState>
        ) : (
          <HomeworkMatrix
            slug={slug}
            lessons={withHomework}
            roster={roster}
            done={done}
            submissionsUnavailable={submissionsUnavailable}
          />
        ))}
    </article>
  );
}
