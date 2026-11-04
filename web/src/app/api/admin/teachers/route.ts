import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { crossSite, jsonBody, siteOrigin } from "@/lib/http";
import {
  adminEmail,
  grantTeacher,
  grantedLetter,
  looksLikeEmail,
  normalizeEmail,
} from "@/lib/teachers";

/* POST { action: "grant" | "revoke", email } — hand out or take back the
 * platform teacher role directly, without an application. Site admins only.
 *
 * Granting works for an address with no account yet: the grant is keyed by
 * email and takes effect the first time that address signs in. Revoking keeps
 * the row, so the history of who let whom in survives. */
export async function POST(req: Request) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const admin = await adminEmail();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  if (!looksLikeEmail(email)) return NextResponse.json({ error: "not an email address" }, { status: 400 });

  if (body.action === "grant") {
    await grantTeacher(email, admin);
    // Any pending application from this address is answered by the grant.
    await prisma.teacherApplication.updateMany({
      where: { status: "pending", user: { email } },
      data: { status: "approved", reviewedBy: admin, reviewedAt: new Date() },
    });
    await sendMail({
      to: email,
      ...grantedLetter(`${siteOrigin(req)}/teach`),
    }).catch(() => null);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "revoke") {
    const { count } = await prisma.teacherGrant.updateMany({
      where: { email, revokedAt: null },
      data: { revokedAt: new Date(), revokedBy: admin },
    });
    if (count === 0) return NextResponse.json({ error: "not a teacher" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action must be grant or revoke" }, { status: 400 });
}
