import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// POST { code } — enroll the caller in the class holding that invite code.
// Idempotent: joining twice is a no-op, not an error.
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

  const raw = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  // Codes are read out loud, so accept the shapes people actually type.
  const code = raw.replace(/[\s-]/g, "");
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  const cls = await prisma.class.findUnique({
    where: { inviteCode: code },
    select: { id: true, slug: true, title: true },
  });
  if (!cls) return NextResponse.json({ error: "no class with that code" }, { status: 404 });

  await prisma.classEnrollment.upsert({
    where: { classId_userId: { classId: cls.id, userId } },
    create: { classId: cls.id, userId },
    update: {},
  });

  return NextResponse.json({ ok: true, slug: cls.slug, title: cls.title });
}
