import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { getAccess } from "@/lib/classes";

/* POST { published: boolean } — put a class on the public site, or take it back
 * off. Teacher only.
 *
 * This is the reason `Class.publishedAt` lives in the database rather than in
 * class.json: a course has to be able to go live in the middle of a lesson,
 * without a deploy. sync-classes.cjs seeds the column when it creates the row and
 * never writes it again, so pressing this button is not something a later release
 * can quietly undo.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const { slug } = await params;
  const access = await getAccess(slug);
  if (!access.classRow) return NextResponse.json({ error: "no such class" }, { status: 404 });
  if (!access.isTeacher) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  if (typeof body.published !== "boolean") {
    return NextResponse.json({ error: "published must be true or false" }, { status: 400 });
  }

  const row = await prisma.class.update({
    where: { id: access.classRow.id },
    // Publishing again re-stamps the date, which is what you want: it records
    // when the class actually went out, not when the row happened to be created.
    data: { publishedAt: body.published ? new Date() : null },
    select: { publishedAt: true },
  });

  return NextResponse.json({ ok: true, publishedAt: row.publishedAt });
}
