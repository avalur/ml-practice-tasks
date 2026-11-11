import { prisma } from "@/lib/db";
import { isMissingTable } from "@/lib/notebook-submissions";
import { Tabs } from "@/components/ui";

export type TeacherTab =
  | "overview"
  | "homework"
  | "attendance"
  | "groups"
  | "grading"
  | "monitor";

/* One row of tabs across every teacher-facing page of a class, so the class
 * page, the homework matrix, attendance, codes, grading and the live monitor
 * read as one place instead of five links scattered over two pages. Only ever
 * rendered for a teacher: the pages it links to 404 for everybody else. */
export async function ClassTeacherNav({
  slug,
  classId,
  studio,
  current,
}: {
  slug: string;
  classId: string;
  studio: boolean;
  current: TeacherTab;
}) {
  const toGrade = await prisma.notebookSubmission
    .count({ where: { classId, status: "submitted" } })
    .catch((err: unknown) => {
      if (isMissingTable(err)) return 0;
      throw err;
    });

  const base = `/classes/${slug}`;
  const hrefs: Record<TeacherTab, string> = {
    overview: base,
    homework: `${base}/homework?tab=homework`,
    attendance: `${base}/homework?tab=attendance`,
    groups: `${base}/homework?tab=groups`,
    grading: `${base}/homework?tab=grading`,
    monitor: `${base}/monitor`,
  };
  const items = [
    { href: hrefs.overview, label: "Overview" },
    { href: hrefs.homework, label: "Homework", testId: "teacher-tab-homework" },
    { href: hrefs.attendance, label: "Attendance", testId: "teacher-tab-attendance" },
    { href: hrefs.groups, label: "Group codes", testId: "teacher-tab-groups" },
    {
      href: hrefs.grading,
      label: "Grading",
      count: toGrade,
      countTone: "warning" as const,
      testId: "teacher-tab-grading",
    },
    { href: hrefs.monitor, label: "Live monitor" },
    ...(studio ? [{ href: `/studio/${slug}`, label: "Edit in Studio ↗" }] : []),
  ];
  return (
    <div className="class-teacher-nav" data-testid="class-teacher-nav">
      <Tabs label="Teacher views" current={hrefs[current]} items={items} />
    </div>
  );
}
