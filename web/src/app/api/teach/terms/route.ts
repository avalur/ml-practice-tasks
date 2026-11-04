import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { normalizeEmail } from "@/lib/teachers";
import { TEACHER_TERMS_VERSION } from "@/content/teacher-terms";

/* POST { version } — accept the teacher terms.
 *
 * The client sends the version it showed, and a mismatch is refused: otherwise
 * a page left open across a terms change would record consent to text the
 * teacher never saw. */
export async function POST(req: Request) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const session = await auth();
  const email = session?.user?.email ? normalizeEmail(session.user.email) : null;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  if (body.version !== TEACHER_TERMS_VERSION) {
    return NextResponse.json(
      { error: "The terms have changed since this page was opened — reload it." },
      { status: 409 },
    );
  }

  const { count } = await prisma.teacherGrant.updateMany({
    where: { email, revokedAt: null },
    data: { termsVersion: TEACHER_TERMS_VERSION, termsAcceptedAt: new Date() },
  });
  if (count === 0) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true });
}
