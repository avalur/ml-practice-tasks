import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
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
  solvedKeys,
  type Item,
} from "@/lib/classes";
import { InviteCodes } from "@/components/InviteCodes";

type Params = { slug: string };
type Search = { lesson?: string };

export const metadata: Metadata = {
  title: "Homework overview — ML Practice",
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
  const { lesson: focusSlug } = await searchParams;
  const cls = await getClassMeta(slug);
  if (!cls) notFound();

  const access = await getAccess(slug);
  if (!access.classRow) notFound();
  if (!access.isTeacher) notFound();

  // Students only: everyone who typed a group code. Teachers are in the
  // enrollment table too (so they show up in their own live monitor), but they
  // are not a row of the homework table.
  const [roster, invites] = await Promise.all([
    classStudents(access.classRow.id),
    classInvites(access.classRow.id),
  ]);
  const ids = roster.map((m) => m.id);
  const solved = await solvedKeys(ids, allRefs(cls));
  const done = (userId: string, type: string, id: string) =>
    solved.has(`${userId}|${type}:${id}`);

  const focus = focusSlug ? findLesson(cls, focusSlug) : null;
  const withHomework = cls.lessons.filter((l) => (l.homework?.items.length ?? 0) > 0);

  return (
    <article>
      <p className="muted class-breadcrumb">
        <Link href="/classes">Classes</Link> ›{" "}
        <Link href={`/classes/${slug}`}>{cls.title}</Link>
      </p>
      <h1>Homework overview</h1>
      <p className="muted">
        {roster.length} student{roster.length === 1 ? "" : "s"} · derived from
        actual submissions, so a student who solves a task outside class still
        counts.
      </p>

      <InviteCodes slug={slug} prefix={codePrefix(slug)} invites={invites} />

      {roster.length === 0 ? (
        <p className="muted">
          {invites.length === 0
            ? "No group codes yet — make one above and read it out to the room."
            : "Nobody has entered a code yet."}
        </p>
      ) : focus && focus.homework ? (
        <>
          <p>
            <Link href={`/classes/${slug}/homework`}>← all lessons</Link>
          </p>
          <h2>{focus.title}</h2>
          <p className="muted">due {focus.homework.due}</p>
          {/* One column per item, and a whole assigned topic is *one* item: a
              26-wide table would be unreadable on a laptop mid-lesson. */}
          <div className="hw-scroll">
            <table className="hw-table">
              <thead>
                <tr>
                  <th className="hw-name">Student</th>
                  <th className="hw-group">Group</th>
                  {focus.homework.items.map((item: Item) =>
                    isGroup(item) ? (
                      <th
                        key={`group:${item.pattern}`}
                        title={`${item.pattern} — ${item.items.length} tasks`}
                      >
                        {item.title}
                      </th>
                    ) : (
                      <th key={`${item.type}:${item.id}`} title={item.id}>
                        {item.id.split("/")[1]}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {roster.map((m) => {
                  const overdue = new Date(focus.homework!.due).getTime() < Date.now();
                  return (
                    <tr key={m.id}>
                      <td className="hw-name">{m.name || m.email}</td>
                      <td className="hw-group" title={m.group?.code}>
                        {m.group?.label}
                      </td>
                      {focus.homework!.items.map((item: Item) => {
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
        </>
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
    </article>
  );
}
