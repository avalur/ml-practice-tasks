import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { adminEmail } from "@/lib/teachers";

/* POST { suspended: boolean, reason? } — the moderation switch. Site admins only.
 *
 * A suspended class is teachers-only again, whatever publishedAt says, and the
 * teachers' own Publish button cannot undo it (the publish route refuses). The
 * reason is shown to them on the class page, so it should be written for them. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const admin = await adminEmail();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { slug } = await params;

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  if (typeof body.suspended !== "boolean") {
    return NextResponse.json({ error: "suspended must be true or false" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
  if (body.suspended && !reason) {
    return NextResponse.json({ error: "Write the reason — the teachers will see it." }, { status: 400 });
  }

  const { count } = await prisma.class.updateMany({
    where: { slug },
    data: body.suspended
      ? { suspendedAt: new Date(), suspendedReason: reason, suspendedBy: admin }
      : { suspendedAt: null, suspendedReason: null, suspendedBy: null },
  });
  if (count === 0) return NextResponse.json({ error: "no such class" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
