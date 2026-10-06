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
  flatten,
  getAccess,
  getClassMeta,
  isGroup,
  isLink,
  solvedKeys,
  type TrackedItem,
  type Item,
} from "@/lib/classes";
import { InviteCodes } from "@/components/InviteCodes";
import { AttendanceToggle } from "@/components/AttendanceToggle";
import { AttendanceBatchButtons } from "@/components/AttendanceBatchButtons";

type Params = { slug: string };
type Search = { lesson?: string; tab?: string };

export const metadata: Metadata = {
  title: "Homework & attendance — ML Practice",
  robots: { index: false },
};

function cellClass(done: number, total: number, overdue: boolean): string {
  if (total === 0) return "hw-na";
  if (done === total) return "hw-full";
  if (done === 0) return overdue ? "hw-none-late" : "hw-none";
  return "hw-part";
}

export default async function HomeworkPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const { lesson: focusSlug, tab } = await searchParams;
  const cls = await getClassMeta(slug);
  if (!cls) notFound();

  const access = await getAccess(slug);
  if (!access.classRow) notFound();
  if (!access.isTeacher) notFound();

  // Students only: everyone who typed a group code. Teachers are in the
  // enrollment table too (so they show up in their own live monitor), but they
  // are not a row of the homework table.
  const [roster, invites, attendances] = await Promise.all([
    classStudents(access.classRow.id),
    classInvites(access.classRow.id),
    prisma.lessonAttendance.findMany({
      where: { classId: access.classRow.id, attended: true },
      select: { lessonSlug: true, userId: true },
    }),
  ]);
  const ids = roster.map((m) => m.id);
  const solved = await solvedKeys(ids, allRefs(cls));
  const done = (userId: string, type: string, id: string) =>
    solved.has(`${userId}|${type}:${id}`);

  const attendedKeys = new Set(attendances.map((a) => `${a.lessonSlug}|${a.userId}`));
  const isAttended = (lessonSlug: string, userId: string) =>
    attendedKeys.has(`${lessonSlug}|${userId}`);

  const focus = focusSlug ? findLesson(cls, focusSlug) : null;
  const withHomework = cls.lessons.filter((l) => (l.homework?.items.length ?? 0) > 0);
  const currentTab = tab ?? (withHomework.length > 0 ? "homework" : "attendance");

  return (
    <article>
      <p className="muted class-breadcrumb">
        <Link href="/classes">Classes</Link> ›{" "}
        <Link href={`/classes/${slug}`}>{cls.title}</Link>
      </p>
      <h1>Homework &amp; attendance</h1>
      <p className="muted">
        {roster.length} student{roster.length === 1 ? "" : "s"} · track submissions
        and in-person lecture attendance.
      </p>

      <InviteCodes slug={slug} prefix={codePrefix(slug)} invites={invites} />

      {roster.length === 0 ? (
        <p className="muted">
          {invites.length === 0
            ? "No group codes yet — make one above and read it out to the room."
            : "Nobody has entered a code yet."}
        </p>
      ) : focus ? (
        <>
          <p>
            <Link href={`/classes/${slug}/homework`}>← all lessons</Link>
          </p>
          <div className="hw-lesson-header">
            <div>
              <h2>{focus.title}</h2>
              <p className="muted">
                {focus.date ? `${focus.date}` : ""}
                {focus.homework ? ` · due ${focus.homework.due}` : ""}
              </p>
            </div>
            <AttendanceBatchButtons
              classSlug={slug}
              lessonSlug={focus.slug}
              userIds={ids}
            />
          </div>
          {/* Detailed table for the focused lesson: attendance column + practice/homework items */}
          {(() => {
            const items: (TrackedItem | Item)[] = focus.homework
              ? focus.homework.items
              : focus.practice;
            return (
              <div className="hw-scroll">
                <table className="hw-table">
                  <thead>
                    <tr>
                      <th className="hw-name">Student</th>
                      <th className="hw-group">Group</th>
                      <th className="hw-att" title="Attendance on this lecture">
                        Attendance
                      </th>
                      {items.map((item) =>
                        isGroup(item) ? (
                          <th
                            key={`group:${item.pattern}`}
                            title={`${item.pattern} — ${item.items.length} tasks`}
                          >
                            {item.title}
                          </th>
                        ) : isLink(item) ? (
                          <th key={`link:${item.href}`} title={item.title}>
                            {item.title}
                          </th>
                        ) : (
                          <th key={`${item.type}:${item.id}`} title={item.id}>
                            {item.id.split("/")[1] ?? item.id}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((m) => {
                      const overdue = focus.homework
                        ? new Date(focus.homework.due).getTime() < Date.now()
                        : false;
                      return (
                        <tr key={m.id}>
                          <td className="hw-name">{m.name || m.email}</td>
                          <td className="hw-group" title={m.group?.code}>
                            {m.group?.label}
                          </td>
                          <td className="hw-att-cell">
                            <AttendanceToggle
                              classSlug={slug}
                              lessonSlug={focus.slug}
                              userId={m.id}
                              initialAttended={isAttended(focus.slug, m.id)}
                              studentName={m.name || m.email || undefined}
                            />
                          </td>
                          {items.map((item) => {
                            if (isLink(item)) {
                              return (
                                <td key={`link:${item.href}`} className="hw-na" title="External link">
                                  —
                                </td>
                              );
                            }
                            const refs = flatten([item]);
                            const n = refs.filter((r) => done(m.id, r.type, r.id)).length;
                            const key = isGroup(item)
                              ? `group:${item.pattern}`
                              : `${item.type}:${item.id}`;
                            return (
                              <td key={key} className={cellClass(n, refs.length, overdue)}>
                                {isGroup(item) ? `${n}/${refs.length}` : n ? "✓" : "·"}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </>
      ) : (
        <>
          {withHomework.length > 0 && (
            <div className="hw-view-tabs">
              <Link
                href={`/classes/${slug}/homework?tab=attendance`}
                className={`bt-clear-btn ${currentTab === "attendance" ? "active" : ""}`}
              >
                Attendance
              </Link>
              <Link
                href={`/classes/${slug}/homework?tab=homework`}
                className={`bt-clear-btn ${currentTab === "homework" ? "active" : ""}`}
              >
                Homework
              </Link>
            </div>
          )}

          {currentTab === "attendance" ? (
            <div className="hw-scroll">
              <table className="hw-table">
                <thead>
                  <tr>
                    <th className="hw-name">Student</th>
                    <th className="hw-group">Group</th>
                    {cls.lessons.map((l) => (
                      <th key={l.slug} title={`${l.title}${l.date ? ` (${l.date})` : ""}`}>
                        <Link href={`/classes/${slug}/homework?lesson=${l.slug}`}>
                          {l.slug.replace(/^l0?/, "")}
                        </Link>
                      </th>
                    ))}
                    <th>total</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((m) => {
                    let attendedCount = 0;
                    const cells = cls.lessons.map((l) => {
                      const attended = isAttended(l.slug, m.id);
                      if (attended) attendedCount++;
                      return (
                        <td key={l.slug} className="hw-att-cell">
                          <AttendanceToggle
                            classSlug={slug}
                            lessonSlug={l.slug}
                            userId={m.id}
                            initialAttended={attended}
                            studentName={m.name || m.email || undefined}
                          />
                        </td>
                      );
                    });
                    return (
                      <tr key={m.id}>
                        <td className="hw-name">{m.name || m.email}</td>
                        <td className="hw-group" title={m.group?.code}>
                          {m.group?.label}
                        </td>
                        {cells}
                        <td className="hw-total">
                          {attendedCount}/{cls.lessons.length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="hw-name">
                      <strong>Attended</strong>
                    </td>
                    <td className="hw-group"></td>
                    {cls.lessons.map((l) => {
                      const cnt = roster.filter((m) => isAttended(l.slug, m.id)).length;
                      return (
                        <td key={l.slug} className="hw-total">
                          {cnt}/{roster.length}
                        </td>
                      );
                    })}
                    <td className="hw-total">
                      {roster.length > 0 && cls.lessons.length > 0
                        ? `${Math.round((attendances.length / (roster.length * cls.lessons.length)) * 100)}%`
                        : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="hw-scroll">
              <table className="hw-table">
                <thead>
                  <tr>
                    <th className="hw-name">Student</th>
                    <th className="hw-group">Group</th>
                    {withHomework.map((l) => (
                      <th key={l.slug} title={l.title}>
                        <Link href={`/classes/${slug}/homework?lesson=${l.slug}`}>
                          {l.slug.replace(/^l0?/, "")}
                        </Link>
                      </th>
                    ))}
                    <th>total</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((m) => {
                    let allDone = 0;
                    let allTotal = 0;
                    const cells = withHomework.map((l) => {
                      const items = flatten(l.homework!.items);
                      const n = items.filter((r) => done(m.id, r.type, r.id)).length;
                      const overdue = new Date(l.homework!.due).getTime() < Date.now();
                      allDone += n;
                      allTotal += items.length;
                      return (
                        <td key={l.slug} className={cellClass(n, items.length, overdue)}>
                          {n}/{items.length}
                        </td>
                      );
                    });
                    return (
                      <tr key={m.id}>
                        <td className="hw-name">{m.name || m.email}</td>
                        <td className="hw-group" title={m.group?.code}>
                          {m.group?.label}
                        </td>
                        {cells}
                        <td className="hw-total">
                          {allDone}/{allTotal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </article>
  );
}
