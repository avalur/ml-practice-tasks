import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Return one submission's code for its owner (used to preload the editor).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sub = await prisma.submission.findUnique({
    where: { id },
    select: {
      userId: true,
      code: true,
      problemId: true,
      clientStatus: true,
      passed: true,
      total: true,
    },
  });
  if (!sub || sub.userId !== userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const solved =
    sub.clientStatus === "passed" || (sub.total > 0 && sub.passed === sub.total);
  return NextResponse.json({
    code: sub.code,
    problemId: sub.problemId,
    solved,
  });
}
