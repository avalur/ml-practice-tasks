import Link from "next/link";

import { formatDate } from "@/lib/classes";
import type { GradingItem } from "@/lib/teaching";
import { Badge, EmptyState } from "@/components/ui";

/** Notebook submissions as a work queue. Each one opens the lesson's homework
 * view, where the review modal (download, grade, feedback) lives. */
export function GradingList({
  items,
  showClass,
  empty,
  testId,
}: {
  items: GradingItem[];
  showClass: boolean;
  empty: string;
  testId?: string;
}) {
  if (items.length === 0) return <EmptyState title="Nothing to grade">{empty}</EmptyState>;
  return (
    <ul className="rows card" data-testid={testId}>
      {items.map((g) => (
        <li key={g.id}>
          <div className="row-main">
            <Link
              className="row-title"
              href={`/classes/${g.classSlug}/homework?lesson=${g.lessonSlug}`}
            >
              {g.student} — {g.assignmentTitle}
            </Link>
            <div className="row-sub">
              {showClass ? `${g.classTitle} › ` : ""}
              {g.lessonTitle} · submitted {formatDate(g.submittedAt)}
            </div>
          </div>
          {g.status === "graded" && g.grade !== null ? (
            <Badge tone="success">
              {g.grade}/{g.maxGrade ?? 100}
            </Badge>
          ) : (
            <Badge tone="warning">to grade</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
