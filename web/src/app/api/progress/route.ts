import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { computeStreak } from "@/lib/stats";

// Solved problem ids + current streak for the logged-in user (drives the
// sidebar badges, progress bar and 🔥 streak). Empty for logged-out users.
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ solved: [], streak: 0 });

  const [rows, streak] = await Promise.all([
    prisma.userProblemProgress.findMany({
      where: { userId, clientSolved: true },
      select: { problemId: true },
    }),
    computeStreak(userId),
  ]);
  return NextResponse.json({ solved: rows.map((r) => r.problemId), streak });
}
