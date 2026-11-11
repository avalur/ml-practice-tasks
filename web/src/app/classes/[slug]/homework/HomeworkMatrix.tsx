import Link from "next/link";

import {
  dueMs,
  flatten,
  isAssignment,
  isOverdue,
  type Lesson,
  type TrackableRef,
} from "@/lib/classes";

type Student = {
  id: string;
  name: string | null;
  email: string | null;
  group: { code: string; label: string } | null;
};

function cellClass(done: number, total: number, overdue: boolean): string {
  if (total === 0) return "hw-na";
  if (done === total) return "hw-full";
  if (done === 0) return overdue ? "hw-none-late" : "hw-none";
  return "hw-part";
}

/** Students × lessons-with-homework, done/total per cell. When the submissions
 * table is missing, assignments cannot be told from "nobody handed it in", so
 * they are left out of the counts and the cell says so. */
export function HomeworkMatrix({
  slug,
  lessons,
  roster,
  done,
  submissionsUnavailable,
}: {
  slug: string;
  lessons: Lesson[];
  roster: Student[];
  done: (userId: string, r: TrackableRef, lessonSlug: string) => boolean;
  submissionsUnavailable: boolean;
}) {
  return (
    <div className="hw-scroll">
      <table className="hw-table">
        <thead>
          <tr>
            <th className="hw-name">Student</th>
            <th className="hw-group">Group</th>
            {lessons.map((l) => (
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
            const cells = lessons.map((l) => {
              const all = flatten(l.homework!.items);
              const skipped = submissionsUnavailable && all.some(isAssignment);
              const items = skipped ? all.filter((r) => !isAssignment(r)) : all;
              const n = items.filter((r) => done(m.id, r, l.slug)).length;
              const overdue = isOverdue(dueMs(l.homework!.due));
              allDone += n;
              allTotal += items.length;
              if (skipped) {
                return (
                  <td
                    key={l.slug}
                    className="hw-unavail"
                    title="Notebook submissions unavailable — assignments not counted"
                    data-testid={`hw-unavailable-${l.slug}`}
                  >
                    {items.length > 0 ? `${n}/${items.length}` : "—"} ⚠
                  </td>
                );
              }
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
  );
}
