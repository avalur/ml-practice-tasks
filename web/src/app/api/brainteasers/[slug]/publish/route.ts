import { NextResponse } from "next/server";
import { crossSite, jsonBody } from "@/lib/http";
import { isSiteAdmin } from "@/lib/admin";
import { isGatedTeaser, setTeaserPublished } from "@/lib/teasers";

/* POST { published: boolean } — put a brain teaser on the site, or take it back
 * off. Site editors only (ADMIN_EMAILS).
 *
 * Same reasoning as the class button: the state is a row rather than code
 * because a puzzle has to be able to go live while an event is running, without
 * a deploy.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const { slug } = await params;
  // Unknown slugs are refused before anything else: this route writes rows keyed
  // by whatever it is handed, so it would happily fill the table with typos.
  if (!isGatedTeaser(slug)) {
    return NextResponse.json({ error: "no such puzzle" }, { status: 404 });
  }
  if (!(await isSiteAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  if (typeof body.published !== "boolean") {
    return NextResponse.json({ error: "published must be true or false" }, { status: 400 });
  }

  const publishedAt = await setTeaserPublished(slug, body.published);
  return NextResponse.json({ ok: true, publishedAt });
}
