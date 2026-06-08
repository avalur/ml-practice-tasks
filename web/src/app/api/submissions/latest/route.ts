import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Code of the logged-in user's most recent submission for a problem, used to
// prefill the editor. Returns { code: string | null } — null when logged out,
// missing problemId, or the user has never submitted to this problem.
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const problemId = new URL(req.url).searchParams.get("problemId");
  if (!userId || !problemId) return NextResponse.json({ code: null });

  const sub = await prisma.submission.findFirst({
    where: { userId, problemId },
    orderBy: { createdAt: "desc" },
    select: { code: true },
  });
  return NextResponse.json({ code: sub?.code ?? null });
}
