import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { adminEmail } from "@/lib/teachers";

/* POST { status: "resolved" | "dismissed" | "open" } — close a report, or
 * reopen one closed by mistake. Site admins only. Closing a report changes
 * nothing about the class; suspending it is a separate, deliberate switch. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const admin = await adminEmail();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  const status = body.status;
  if (status !== "resolved" && status !== "dismissed" && status !== "open") {
    return NextResponse.json({ error: "status must be resolved, dismissed or open" }, { status: 400 });
  }

  const { count } = await prisma.classReport.updateMany({
    where: { id },
    data:
      status === "open"
        ? { status, resolvedBy: null, resolvedAt: null }
        : { status, resolvedBy: admin, resolvedAt: new Date() },
  });
  if (count === 0) return NextResponse.json({ error: "no such report" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
