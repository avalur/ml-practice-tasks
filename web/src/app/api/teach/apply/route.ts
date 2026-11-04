import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody, rateLimited, siteOrigin } from "@/lib/http";
import {
  APPLICATION_LIMITS,
  escapeHtml,
  mailAdmins,
  teacherState,
} from "@/lib/teachers";

/* POST { about, plans, link? } — ask to become a platform teacher.
 *
 * Anyone signed in may apply; nothing is granted here. The application waits in
 * /admin/teachers for a site admin, who is emailed about it. One pending
 * application per person: a second one would only be a duplicate in the queue. */
export async function POST(req: Request) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  // Each accepted application emails every admin, so bound it per address too.
  if (rateLimited(req, "teach-apply", 5, 60 * 60_000)) {
    return NextResponse.json({ error: "too many requests — try again later" }, { status: 429 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  const about = typeof body.about === "string" ? body.about.trim() : "";
  const plans = typeof body.plans === "string" ? body.plans.trim() : "";
  const link = typeof body.link === "string" ? body.link.trim() : "";
  if (about.length < 20 || plans.length < 20) {
    return NextResponse.json(
      { error: "Tell us a little more — a couple of sentences in each field." },
      { status: 400 },
    );
  }
  if (
    about.length > APPLICATION_LIMITS.about ||
    plans.length > APPLICATION_LIMITS.plans ||
    link.length > APPLICATION_LIMITS.link
  ) {
    return NextResponse.json({ error: "too long" }, { status: 400 });
  }
  if (link && !/^https?:\/\/\S+$/i.test(link)) {
    return NextResponse.json({ error: "The link must start with http:// or https://" }, { status: 400 });
  }

  const state = await teacherState();
  if (state.kind === "active" || state.kind === "terms") {
    return NextResponse.json({ error: "You are already a teacher." }, { status: 409 });
  }
  if (state.kind === "pending") {
    return NextResponse.json({ error: "Your application is already waiting for review." }, { status: 409 });
  }

  const app = await prisma.teacherApplication.create({
    data: { userId, about, plans, link: link || null },
    select: { id: true },
  });

  const who = session.user?.name ?? session.user?.email ?? userId;
  const url = `${siteOrigin(req)}/admin/teachers`;
  await mailAdmins({
    subject: `Teacher application: ${who}`,
    text: `${who} <${session.user?.email}> applied to teach.\n\n${about}\n\n${plans}\n\nReview: ${url}\n`,
    html:
      `<p><strong>${escapeHtml(who)}</strong> &lt;${escapeHtml(session.user?.email ?? "")}&gt; applied to teach.</p>` +
      `<p>${escapeHtml(about)}</p><p>${escapeHtml(plans)}</p>` +
      `<p><a href="${url}">Review applications</a></p>`,
  });

  return NextResponse.json({ ok: true, id: app.id });
}
