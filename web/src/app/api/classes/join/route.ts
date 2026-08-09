import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { normalizeCode } from "@/lib/classes";

// POST { code } — join the group that owns this invite code.
//
// Classes themselves are public, so this is not about getting in: it is what
// makes a visitor a *student* of one, whose homework the teacher can see. A code
// identifies a group and a class can hand out several, so joining records which
// one was used. Idempotent, and a different code moves the student to that group
// rather than failing.
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

  const code = normalizeCode(typeof body.code === "string" ? body.code : "");
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  const invite = await prisma.classInvite.findUnique({
    where: { codeKey: code },
    select: {
      id: true,
      label: true,
      class: { select: { id: true, slug: true, title: true } },
    },
  });
  if (!invite) {
    return NextResponse.json({ error: "no group with that code" }, { status: 404 });
  }

  await prisma.classEnrollment.upsert({
    where: { classId_userId: { classId: invite.class.id, userId } },
    create: { classId: invite.class.id, userId, inviteId: invite.id },
    update: { inviteId: invite.id },
  });

  return NextResponse.json({
    ok: true,
    slug: invite.class.slug,
    title: invite.class.title,
    group: invite.label,
  });
}
