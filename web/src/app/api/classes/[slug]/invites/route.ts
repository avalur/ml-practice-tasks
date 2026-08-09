import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAccess, normalizeCode } from "@/lib/classes";

/* Invite codes of a class — teacher only.
 *
 * The teacher writes the code, not the machine: it gets dictated to a room, so
 * something like "TLF-OSEN-A" beats a random string. Each code names a group,
 * which is how cohorts stay apart in the homework overview.
 */

const MAX_CODE = 24;
const MAX_LABEL = 60;

/** POST { code, label } — add a code. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getAccess(slug);
  if (!access.classRow) return NextResponse.json({ error: "no such class" }, { status: 404 });
  if (!access.isTeacher) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const code = String(body.code ?? "").trim().toUpperCase();
  const label = String(body.label ?? "").trim();
  const codeKey = normalizeCode(code);

  if (!label) return NextResponse.json({ error: "name the group" }, { status: 400 });
  if (label.length > MAX_LABEL) {
    return NextResponse.json({ error: "group name is too long" }, { status: 400 });
  }
  if (code.length > MAX_CODE || !/^[A-Z0-9][A-Z0-9-]*$/.test(code)) {
    return NextResponse.json(
      { error: "codes may use A–Z, digits and dashes" },
      { status: 400 },
    );
  }
  // Short codes get guessed, and a guess enrolls a stranger into someone's class
  // list. Four characters of actual content is the floor.
  if (codeKey.length < 4) {
    return NextResponse.json({ error: "code is too short" }, { status: 400 });
  }

  const clash = await prisma.classInvite.findUnique({
    where: { codeKey },
    select: { class: { select: { slug: true } } },
  });
  if (clash) {
    return NextResponse.json(
      {
        error:
          clash.class.slug === slug
            ? "this class already has that code"
            : "another class is already using that code",
      },
      { status: 409 },
    );
  }

  const invite = await prisma.classInvite.create({
    data: { classId: access.classRow.id, code, codeKey, label },
    select: { id: true, code: true, label: true },
  });
  return NextResponse.json({ ok: true, invite });
}

/** DELETE { id } — drop a code nobody has used yet.
 *
 * A code with students behind it stays: deleting it would blank out which group
 * they belong to, and the roster is the whole point of the feature. */
export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getAccess(slug);
  if (!access.classRow) return NextResponse.json({ error: "no such class" }, { status: 404 });
  if (!access.isTeacher) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const id = String(body.id ?? "");
  const invite = await prisma.classInvite.findFirst({
    where: { id, classId: access.classRow.id },
    select: { id: true, _count: { select: { enrollments: true } } },
  });
  if (!invite) return NextResponse.json({ error: "no such code" }, { status: 404 });
  if (invite._count.enrollments > 0) {
    return NextResponse.json(
      { error: `${invite._count.enrollments} student(s) joined with this code` },
      { status: 409 },
    );
  }

  await prisma.classInvite.delete({ where: { id: invite.id } });
  return NextResponse.json({ ok: true });
}
