import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// GET — return solved notebook IDs for the logged-in user.
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ solved: [] });

  const rows = await prisma.userNotebookProgress.findMany({
    where: { userId },
    select: { notebookId: true },
  });
  return NextResponse.json({ solved: rows.map((r) => r.notebookId) });
}

// POST { notebookId: "section/slug" } — record a notebook as solved.
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

  await prisma.userNotebookProgress.upsert({
    where: { userId_notebookId: { userId, notebookId } },
    create: { userId, notebookId },
    update: {},
  });

  return NextResponse.json({ ok: true, notebookId });
}
