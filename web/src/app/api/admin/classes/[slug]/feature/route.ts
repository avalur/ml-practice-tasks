import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { adminEmail } from "@/lib/teachers";

/* POST { featured: boolean } — list a studio course on /classes, or take it back
 * to unlisted. Site admins only: on an open platform, what the front page
 * shows is an editorial decision. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  if (!(await adminEmail())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { slug } = await params;
  const body = await jsonBody(req);
  if (!body || typeof body.featured !== "boolean") {
    return NextResponse.json({ error: "featured must be true or false" }, { status: 400 });
  }
  const { count } = await prisma.class.updateMany({
    where: { slug, source: "studio" },
    data: { featuredAt: body.featured ? new Date() : null },
  });
  if (count === 0) return NextResponse.json({ error: "no such studio course" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
