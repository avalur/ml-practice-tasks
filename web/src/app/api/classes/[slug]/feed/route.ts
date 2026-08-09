import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { classRoster, getAccess } from "@/lib/classes";

const MAX_EVENTS = 120;
const DEFAULT_WINDOW_MS = 2 * 60 * 60 * 1000; // first load shows the last 2 hours
const WORKING_WINDOW_MS = 5 * 60 * 1000;

export type FeedEvent = {
  kind: "problem" | "notebook";
  at: string;
  userId: string;
  userName: string;
  id: string;
  title: string | null;
  status: "passed" | "failed";
  passed?: number;
  total?: number;
};

// GET ?since=<iso> — activity of this class's members, newest first. Teacher only.
//
// Polled every few seconds by the monitor window. Notebooks are deliberately
// coarser than problems: marimo re-runs its checker on every edit, so a raw
// notebook feed would drown out the problem submissions. Only the
// unsolved → solved transition is reported, plus a count of who is mid-attempt.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const access = await getAccess(slug);
  if (!access.classRow) return NextResponse.json({ error: "no such class" }, { status: 404 });
  if (!access.isTeacher) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sinceParam = new URL(req.url).searchParams.get("since");
  const parsed = sinceParam ? Date.parse(sinceParam) : NaN;
  const since = new Date(
    Number.isFinite(parsed) ? parsed : Date.now() - DEFAULT_WINDOW_MS,
  );

  const roster = await classRoster(access.classRow.id);
  const ids = roster.map((m) => m.id);
  const nameOf = new Map(
    roster.map((m) => [m.id, m.name || m.email || "anonymous"] as const),
  );

  if (ids.length === 0) {
    return NextResponse.json({ now: new Date().toISOString(), events: [], working: 0, members: 0 });
  }

  const [submissions, solves, working] = await Promise.all([
    prisma.submission.findMany({
      where: { userId: { in: ids }, createdAt: { gt: since } },
      orderBy: { createdAt: "desc" },
      take: MAX_EVENTS,
      select: {
        createdAt: true,
        userId: true,
        problemId: true,
        clientStatus: true,
        passed: true,
        total: true,
        problem: { select: { title: true } },
      },
    }),
    prisma.userNotebookProgress.findMany({
      where: { userId: { in: ids }, solvedAt: { gt: since } },
      orderBy: { solvedAt: "desc" },
      take: MAX_EVENTS,
      select: { solvedAt: true, userId: true, notebookId: true },
    }),
    prisma.userNotebookProgress.count({
      where: {
        userId: { in: ids },
        solvedAt: null,
        lastRunAt: { gt: new Date(Date.now() - WORKING_WINDOW_MS) },
      },
    }),
  ]);

  const events: FeedEvent[] = [
    ...submissions.map((s) => ({
      kind: "problem" as const,
      at: s.createdAt.toISOString(),
      userId: s.userId,
      userName: nameOf.get(s.userId) ?? "anonymous",
      id: s.problemId,
      title: s.problem?.title ?? null,
      status:
        s.clientStatus === "passed" && s.total > 0 && s.passed === s.total
          ? ("passed" as const)
          : ("failed" as const),
      passed: s.passed,
      total: s.total,
    })),
    ...solves.map((n) => ({
      kind: "notebook" as const,
      at: (n.solvedAt as Date).toISOString(),
      userId: n.userId,
      userName: nameOf.get(n.userId) ?? "anonymous",
      id: n.notebookId,
      title: null,
      status: "passed" as const,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, MAX_EVENTS);

  return NextResponse.json({
    now: new Date().toISOString(),
    events,
    working,
    members: ids.length,
  });
}
