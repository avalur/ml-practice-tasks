import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { crossSite, jsonBody, siteOrigin } from "@/lib/http";
import {
  APPLICATION_LIMITS,
  adminEmail,
  grantTeacher,
  grantedLetter,
  rejectedLetter,
} from "@/lib/teachers";

/* POST { decision: "approve" | "reject", note? } — answer one application.
 * Site admins only. Approving creates (or restores) the applicant's
 * TeacherGrant; rejecting records a note the applicant sees on /teach and in
 * the letter. Either way the applicant is emailed. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const admin = await adminEmail();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  const decision = body.decision;
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "decision must be approve or reject" }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, APPLICATION_LIMITS.note) : "";

  const app = await prisma.teacherApplication.findUnique({
    where: { id },
    select: { status: true, user: { select: { email: true } } },
  });
  if (!app) return NextResponse.json({ error: "no such application" }, { status: 404 });
  const email = app.user.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "applicant has no email address" }, { status: 409 });

  /* Claimed atomically on the pending state, so two admins answering the same
   * application at once cannot both send a letter — or send contradictory ones. */
  const { count } = await prisma.teacherApplication.updateMany({
    where: { id, status: "pending" },
    data: {
      status: decision === "approve" ? "approved" : "rejected",
      reviewedBy: admin,
      reviewedAt: new Date(),
      reviewNote: note || null,
    },
  });
  if (count === 0) return NextResponse.json({ error: "already answered" }, { status: 409 });

  const link = `${siteOrigin(req)}/teach`;
  if (decision === "approve") {
    await grantTeacher(email, admin);
    await sendMail({ to: email, ...grantedLetter(link) }).catch(() => null);
  } else {
    await sendMail({ to: email, ...rejectedLetter(link, note || null) }).catch(() => null);
  }
  return NextResponse.json({ ok: true });
}
