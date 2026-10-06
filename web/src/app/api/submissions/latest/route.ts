import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Code of the logged-in user's most recent submission for a problem, used to
// prefill the editor. Returns { code: string | null, solved: boolean } — null/false
// when logged out, missing problemId, or the user has never submitted to this problem.
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const problemId = new URL(req.url).searchParams.get("problemId");
  if (!userId || !problemId) return NextResponse.json({ code: null, solved: false });

  const [sub, progress] = await Promise.all([
    prisma.submission.findFirst({
      where: { userId, problemId },
      orderBy: { createdAt: "desc" },
      select: { code: true, clientStatus: true, passed: true, total: true },
    }),
    prisma.userProblemProgress.findUnique({
      where: { userId_problemId: { userId, problemId } },
      select: { clientSolved: true },
    }),
  ]);

  const solved = Boolean(
    progress?.clientSolved ||
      sub?.clientStatus === "passed" ||
      (sub && sub.total > 0 && sub.passed === sub.total),
  );

  return NextResponse.json({ code: sub?.code ?? null, solved });
}
