import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody, rateLimited, siteOrigin } from "@/lib/http";
import { escapeHtml, isPlatformTeacher, mailAdmins } from "@/lib/teachers";
import { getManifest } from "@/lib/content";
import { validateProposal, type ProposalCheck, type ProposalInput } from "@/lib/proposal-shared";

/* POST { ...ProposalInput, check } — propose a task for the catalogue.
 *
 * Validated for shape here; whether it actually works is what the in-browser
 * check (reported in `check`) and, authoritatively, the admin's pytest run
 * after `pnpm db:proposal` decide. A proposal never becomes a problem by
 * itself. */
export async function POST(req: Request) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  if (rateLimited(req, "proposal", 10, 60 * 60_000)) {
    return NextResponse.json({ error: "too many proposals — try again later" }, { status: 429 });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isPlatformTeacher())) return NextResponse.json({ error: "teacher role required" }, { status: 403 });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  const p = body as Partial<ProposalInput> & { check?: ProposalCheck };
  const errors = validateProposal(p);
  const manifest = await getManifest();
  if (p.topic && p.slug && manifest.problems.some((x) => x.id === `${p.topic}/${p.slug}`)) {
    errors.push(`${p.topic}/${p.slug} already exists — pick another slug`);
  }
  if (errors.length) return NextResponse.json({ error: errors.join("\n"), errors }, { status: 400 });

  const pending = await prisma.problemProposal.count({ where: { userId, status: "pending" } });
  if (pending >= 10) {
    return NextResponse.json({ error: "You have 10 proposals waiting — let the reviewer catch up." }, { status: 409 });
  }

  const check = p.check && typeof p.check === "object" ? p.check : undefined;
  const row = await prisma.problemProposal.create({
    data: {
      userId,
      topic: p.topic!,
      slug: p.slug!,
      title: p.title!.trim(),
      difficulty: p.difficulty!,
      entry: p.entry!,
      statement: p.statement!,
      reference: p.reference!,
      test: p.test!,
      banned: p.banned ?? {},
      pyDeps: p.pyDeps ?? ["numpy"],
      check: check ?? undefined,
    },
    select: { id: true },
  });

  const who = session.user?.name ?? session.user?.email ?? userId;
  const url = `${siteOrigin(req)}/admin/proposals`;
  await mailAdmins({
    subject: `Task proposal: ${p.topic}/${p.slug}`,
    text: `${who} proposed "${p.title}" (${p.topic}/${p.slug}).\n\nReview: ${url}\n`,
    html: `<p>${escapeHtml(who)} proposed <strong>${escapeHtml(p.title!)}</strong> (${escapeHtml(`${p.topic}/${p.slug}`)}).</p><p><a href="${url}">Review proposals</a></p>`,
  });
  return NextResponse.json({ ok: true, id: row.id });
}
