import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// GET — two modes:
//   • no params           → { solved: [...notebookIds] } (drives sidebar ✓)
//   • ?notebookId=sec/slug → { code } (latest saved code, for restore on load)
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const notebookId = new URL(req.url).searchParams.get("notebookId");

  if (notebookId) {
    if (!userId) return NextResponse.json({ code: null });
    const row = await prisma.userNotebookProgress.findUnique({
      where: { userId_notebookId: { userId, notebookId } },
      select: { code: true },
    });
    return NextResponse.json({ code: row?.code ?? null });
  }

  if (!userId) return NextResponse.json({ solved: [] });
  const rows = await prisma.userNotebookProgress.findMany({
    where: { userId, solvedAt: { not: null } },
    select: { notebookId: true },
  });
  return NextResponse.json({ solved: rows.map((r) => r.notebookId) });
}

// POST { notebookId, code, solved } — record a checker run. Always saves the
// latest code; marks solved (sticky) when all tests pass.
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

  const notebookId = body.notebookId;
  if (typeof notebookId !== "string" || !notebookId.includes("/")) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.slice(0, 50000) : null;
  const solved = body.solved === true;
  const now = new Date();

  await prisma.userNotebookProgress.upsert({
    where: { userId_notebookId: { userId, notebookId } },
    create: {
      userId,
      notebookId,
      code,
      attemptCount: 1,
      lastRunAt: now,
      solvedAt: solved ? now : null,
    },
    update: {
      code,
      attemptCount: { increment: 1 },
      lastRunAt: now,
      // solvedAt handled below so an earlier solve time is never clobbered.
    },
  });

  // Set solvedAt once (sticky), only on the first solve.
  if (solved) {
    await prisma.userNotebookProgress.updateMany({
      where: { userId, notebookId, solvedAt: null },
      data: { solvedAt: now },
    });
  }

  return NextResponse.json({ ok: true, notebookId });
}

// DELETE ?notebookId=sec/slug — Reset to starter: clear saved code AND mark
// the notebook unsolved (so the sidebar ✓ disappears).
export async function DELETE(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const notebookId = new URL(req.url).searchParams.get("notebookId");
  if (!notebookId) return NextResponse.json({ error: "bad request" }, { status: 400 });

  await prisma.userNotebookProgress.updateMany({
    where: { userId, notebookId },
    data: { code: null, solvedAt: null },
  });

  return NextResponse.json({ ok: true });
}
