import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { isSiteAdmin } from "@/lib/admin";
import { PageHeader, Stat } from "@/components/ui";

/* The admin home: what is waiting, one tile per queue. Checked here as well as
 * in the layout: an RSC request can render a page without re-running its
 * parent layout, so a layout is not a boundary. */
export default async function AdminIndex() {
  if (!(await isSiteAdmin())) notFound();
  const [applications, reports, proposals, grants, suspended] = await Promise.all([
    prisma.teacherApplication.count({ where: { status: "pending" } }),
    prisma.classReport.count({ where: { status: "open" } }),
    prisma.problemProposal.count({ where: { status: "pending" } }).catch(() => 0),
    prisma.teacherGrant.count({ where: { revokedAt: null } }),
    prisma.class.count({ where: { suspendedAt: { not: null } } }),
  ]);
  return (
    <div className="admin-home">
      <PageHeader title="Admin" subtitle="Teacher applications, reports and task proposals." />
      <div className="stats" data-testid="admin-home">
        <Stat
          value={applications}
          label="teacher applications"
          tone={applications ? "warning" : undefined}
          href="/admin/teachers"
        />
        <Stat
          value={reports}
          label="open reports"
          tone={reports ? "danger" : undefined}
          href="/admin/reports"
        />
        <Stat
          value={proposals}
          label="task proposals"
          tone={proposals ? "warning" : undefined}
          href="/admin/proposals"
        />
        <Stat value={grants} label="active teachers" href="/admin/teachers" />
        <Stat value={suspended} label="suspended classes" href="/admin/reports" />
      </div>
    </div>
  );
}
