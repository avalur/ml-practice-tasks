import { formatDay } from "@/lib/classes";
import type { HomeworkEntry } from "@/lib/student";
import { Badge, type Tone } from "@/components/ui";

export function DueBadge({ entry, tone }: { entry: HomeworkEntry; tone: Tone }) {
  if (entry.done >= entry.total) return <Badge tone="success">done</Badge>;
  if (!entry.due) return <Badge tone="neutral">no deadline</Badge>;
  return (
    <Badge tone={tone}>
      {entry.overdue ? "overdue · " : "due "}
      {formatDay(entry.due)}
    </Badge>
  );
}
