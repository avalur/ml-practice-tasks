import Link from "next/link";

import type { Lesson } from "@/lib/classes";
import { AttendanceToggle } from "@/components/AttendanceToggle";

type Student = {
  id: string;
  name: string | null;
  email: string | null;
  group: { code: string; label: string } | null;
};

/** Students × lessons, one toggle per cell. A lesson header opens that lesson's
 * detailed view, where a whole row can be marked at once. */
export function AttendanceMatrix({
  slug,
  lessons,
  roster,
  attended,
}: {
  slug: string;
  lessons: Lesson[];
  roster: Student[];
  attended: Set<string>;
}) {
  const isAttended = (lessonSlug: string, userId: string) => attended.has(`${lessonSlug}|${userId}`);
  return (
    <div className="hw-scroll">
      <table className="hw-table">
        <thead>
          <tr>
            <th className="hw-name">Student</th>
            <th className="hw-group">Group</th>
            {lessons.map((l) => (
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
            let count = 0;
            const cells = lessons.map((l) => {
              const on = isAttended(l.slug, m.id);
              if (on) count++;
              return (
                <td key={l.slug} className="hw-att-cell">
                  <AttendanceToggle
                    classSlug={slug}
                    lessonSlug={l.slug}
                    userId={m.id}
                    initialAttended={on}
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
                  {count}/{lessons.length}
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
            {lessons.map((l) => {
              const n = roster.filter((m) => isAttended(l.slug, m.id)).length;
              return (
                <td key={l.slug} className="hw-total">
                  {n}/{roster.length}
                </td>
              );
            })}
            <td className="hw-total">
              {roster.length > 0 && lessons.length > 0
                ? `${Math.round((attended.size / (roster.length * lessons.length)) * 100)}%`
                : "—"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
