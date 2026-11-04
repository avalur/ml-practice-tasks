import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { crossSite, jsonBody, siteOrigin } from "@/lib/http";
import { adminEmail, escapeHtml } from "@/lib/teachers";

/* POST { decision: "accept" | "reject", note? } — answer a task proposal.
 * Site admins only. Accepting changes nothing on the site: it marks the
 * proposal ready for `pnpm db:proposal <id>`, which writes the files into
 * problems/ for the usual generate → pytest → commit. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const admin = await adminEmail();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await jsonBody(req);
  const decision = body?.decision;
  if (decision !== "accept" && decision !== "reject") {
    return NextResponse.json({ error: "decision must be accept or reject" }, { status: 400 });
  }
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2000) : "";

  const { count } = await prisma.problemProposal.updateMany({
    where: { id, status: "pending" },
    data: {
      status: decision === "accept" ? "accepted" : "rejected",
      reviewNote: note || null,
      reviewedBy: admin,
      reviewedAt: new Date(),
    },
  });
  if (count === 0) return NextResponse.json({ error: "no pending proposal with that id" }, { status: 409 });

  const p = await prisma.problemProposal.findUniqueOrThrow({
    where: { id },
    select: { title: true, user: { select: { email: true } } },
  });
  if (p.user.email) {
    const link = `${siteOrigin(req)}/studio/proposals`;
    const verdict = decision === "accept" ? "was accepted and will be added to the catalogue" : "was not accepted";
    await sendMail({
      to: p.user.email,
      subject: `Your task proposal “${p.title}”`,
      text: `Your proposal “${p.title}” ${verdict}.${note ? `\n\nFrom the reviewer:\n${note}` : ""}\n\n${link}\n`,
      html:
        `<p>Your proposal <strong>${escapeHtml(p.title)}</strong> ${verdict}.</p>` +
        (note ? `<blockquote>${escapeHtml(note)}</blockquote>` : "") +
        `<p><a href="${link}">Your proposals</a></p>`,
    }).catch(() => null);
  }
  return NextResponse.json({ ok: true });
}
