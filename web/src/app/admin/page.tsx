import { prisma } from "@/lib/db";
import { PageHeader, Stat } from "@/components/ui";

/* The admin home: what is waiting, one tile per queue. The layout has already
 * 404'd anyone who is not in ADMIN_EMAILS. */
export default async function AdminIndex() {
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
