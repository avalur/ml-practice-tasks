import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { normalizeCode } from "@/lib/classes";

// POST { code } — join the group that owns this invite code.
//
// Classes themselves are public, so this is not about getting in: it is what
// makes a visitor a *student* of one, whose homework the teacher can see. A code
// identifies a group and a class can hand out several, so joining records which
// one was used. Idempotent, and a different code moves the student to that group
// rather than failing.
export async function POST(req: Request) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  const code = normalizeCode(typeof body.code === "string" ? body.code : "");
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  const invite = await prisma.classInvite.findUnique({
    where: { codeKey: code },
    select: {
      id: true,
      label: true,
      class: {
        select: {
          id: true,
          slug: true,
          title: true,
          publishedAt: true,
          teacherEmails: true,
        },
      },
    },
  });
  if (!invite) {
    return NextResponse.json({ error: "no group with that code" }, { status: 404 });
  }

  /* A draft class has nothing to join yet — and the same answer as an unknown
   * code, so a code handed out early does not confirm that the class exists. Its
   * own teachers are the exception: trying the code is how you check it works. */
  const email = session.user?.email?.toLowerCase();
  const isTeacher = !!email && invite.class.teacherEmails.includes(email);
  if (!invite.class.publishedAt && !isTeacher) {
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
