import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** Return the list of problem IDs the authenticated user has favorited. */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ ids: [] });

  const rows = await prisma.favorite.findMany({
    where: { userId },
    select: { problemId: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ ids: rows.map((r) => r.problemId) });
}

/** Toggle a favorite: add if absent, remove if present. */
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
  if (typeof problemId !== "string") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const existing = await prisma.favorite.findUnique({
    where: { userId_problemId: { userId, problemId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorited: false });
  } else {
    await prisma.favorite.create({ data: { userId, problemId } });
    return NextResponse.json({ favorited: true });
  }
}
