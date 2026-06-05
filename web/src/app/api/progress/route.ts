import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Solved problem ids for the current user (drives solved badges on the list).
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ solved: [] });

  const rows = await prisma.userProblemProgress.findMany({
    where: { userId, clientSolved: true },
    select: { problemId: true },
  });
  return NextResponse.json({ solved: rows.map((r) => r.problemId) });
}
