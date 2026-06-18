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

// DELETE ?problemId=topic/slug — full Reset: erase the user's submissions and
// progress for this problem, so the ✓ clears and a reload shows the starter
// (no saved solution lingers).
export async function DELETE(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const problemId = new URL(req.url).searchParams.get("problemId");
  if (!problemId) return NextResponse.json({ error: "bad request" }, { status: 400 });

  await prisma.$transaction([
    prisma.submission.deleteMany({ where: { userId, problemId } }),
    prisma.userProblemProgress.deleteMany({ where: { userId, problemId } }),
  ]);

  return NextResponse.json({ ok: true });
}
