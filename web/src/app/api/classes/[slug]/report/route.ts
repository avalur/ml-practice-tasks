import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAccess, getClassMeta } from "@/lib/classes";
import { crossSite, jsonBody, rateLimited, siteOrigin } from "@/lib/http";
import {
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  escapeHtml,
  mailAdmins,
  type ReportReason,
} from "@/lib/teachers";

/* POST { reason, details, lesson? } — flag a class for the site admins.
 *
 * Signed-in visitors only, and only for a class they can see: reporting is not
 * a way to learn that a draft exists. The class's own teachers cannot report it
 * (there is nothing for them to report to themselves). Every report emails the
 * admins, so it is rate limited per address as well as per person. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  if (rateLimited(req, "class-report", 10, 60 * 60_000)) {
    return NextResponse.json({ error: "too many reports — try again later" }, { status: 429 });
  }
  const { slug } = await params;
  const access = await getAccess(slug);
  if (!access.classRow || !access.visible) {
    return NextResponse.json({ error: "no such class" }, { status: 404 });
  }
  if (!access.userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (access.isTeacher) return NextResponse.json({ error: "this is your own class" }, { status: 403 });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  const reason = body.reason;
  if (typeof reason !== "string" || !(reason in REPORT_REASONS)) {
    return NextResponse.json({ error: "pick a reason" }, { status: 400 });
  }
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if (details.length < 10) {
    return NextResponse.json({ error: "Describe what is wrong in a sentence or two." }, { status: 400 });
  }
  if (details.length > REPORT_DETAILS_MAX) return NextResponse.json({ error: "too long" }, { status: 400 });

  // A lesson slug is only kept when it names a real lesson of this class: it
  // ends up in a link in the admin's queue.
  let lessonSlug: string | null = null;
  if (typeof body.lesson === "string" && body.lesson) {
    const cls = await getClassMeta(slug);
    lessonSlug = cls?.lessons.some((l) => l.slug === body.lesson) ? body.lesson : null;
  }

  // One person, one open report per class: a second one is the same complaint.
  const open = await prisma.classReport.count({
    where: { classId: access.classRow.id, reporterId: access.userId, status: "open" },
  });
  if (open > 0) {
    return NextResponse.json(
      { error: "You have already reported this class — it is waiting for review." },
      { status: 409 },
    );
  }

  await prisma.classReport.create({
    data: {
      classId: access.classRow.id,
      lessonSlug,
      reporterId: access.userId,
      reason,
      details,
    },
  });

  const label = REPORT_REASONS[reason as ReportReason];
  const url = `${siteOrigin(req)}/admin/reports`;
  await mailAdmins({
    subject: `Report: ${access.classRow.title}`,
    text: `${access.classRow.title} (${slug}) was reported: ${label}.\n\n${details}\n\nReview: ${url}\n`,
    html:
      `<p><strong>${escapeHtml(access.classRow.title)}</strong> (${escapeHtml(slug)}) was reported: ${escapeHtml(label)}.</p>` +
      `<p>${escapeHtml(details)}</p><p><a href="${url}">Open the report queue</a></p>`,
  });

  return NextResponse.json({ ok: true });
}
