import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Persist a run and update the user's progress. Client-reported (spoofable) —
// stored as clientStatus; a future server re-verification pass sets verifiedStatus.
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const problemId = body.problemId;
  const code = body.code;
  const clientStatus = body.clientStatus;
  if (typeof problemId !== "string" || typeof code !== "string" || typeof clientStatus !== "string") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const problem = await prisma.problem.findUnique({ where: { id: problemId } });
  if (!problem) return NextResponse.json({ error: "unknown problem" }, { status: 404 });

  const passed = Number(body.passed) || 0;
  const total = Number(body.total) || 0;
  const durationMs = Number.isFinite(Number(body.durationMs)) ? Number(body.durationMs) : null;
  const solved = clientStatus === "passed" && total > 0 && passed === total;

  const progress = await prisma.$transaction(async (tx) => {
    const submission = await tx.submission.create({
      data: {
        userId,
        problemId,
        code: code.slice(0, 50000),
        clientStatus,
        passed,
        total,
        durationMs,
        pyodideVersion: typeof body.pyodideVersion === "string" ? body.pyodideVersion : null,
        runnerVersion: typeof body.runnerVersion === "string" ? body.runnerVersion : null,
      },
    });
    const existing = await tx.userProblemProgress.findUnique({
      where: { userId_problemId: { userId, problemId } },
    });
    const now = new Date();
    return tx.userProblemProgress.upsert({
      where: { userId_problemId: { userId, problemId } },
      create: {
        userId,
        problemId,
        attemptCount: 1,
        lastSubmittedAt: now,
        bestPassed: passed,
        bestTotal: total,
        clientSolved: solved,
        solvedAt: solved ? now : null,
        bestSubmissionId: solved ? submission.id : null,
      },
      update: {
        attemptCount: { increment: 1 },
        lastSubmittedAt: now,
        bestPassed: Math.max(existing?.bestPassed ?? 0, passed),
        bestTotal: Math.max(existing?.bestTotal ?? 0, total),
        clientSolved: (existing?.clientSolved ?? false) || solved,
        solvedAt: existing?.solvedAt ?? (solved ? now : null),
        bestSubmissionId:
          solved && !existing?.bestSubmissionId ? submission.id : (existing?.bestSubmissionId ?? null),
      },
    });
  });

  return NextResponse.json({ ok: true, solved: progress.clientSolved });
}
