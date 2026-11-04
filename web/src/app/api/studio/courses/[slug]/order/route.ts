import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { editableClass } from "@/lib/studio";

/* POST { lessons: [slug, …] } — the new order of every lesson in the course.
 * The list must name each lesson exactly once, so a stale page cannot drop one. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const { slug } = await params;
  const g = await editableClass(slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await jsonBody(req);
  const order = body && Array.isArray(body.lessons) ? body.lessons.map(String) : null;
  if (!order) return NextResponse.json({ error: "lessons must be a list" }, { status: 400 });

  const rows = await prisma.studioLesson.findMany({ where: { classId: g.cls.id }, select: { id: true, slug: true } });
  const bySlug = new Map(rows.map((r) => [r.slug, r.id]));
  if (order.length !== rows.length || new Set(order).size !== order.length || order.some((s) => !bySlug.has(s))) {
    return NextResponse.json({ error: "The page is out of date — reload it." }, { status: 409 });
  }
  await prisma.$transaction(
    order.map((s, position) => prisma.studioLesson.update({ where: { id: bySlug.get(s)! }, data: { position } })),
  );
  return NextResponse.json({ ok: true });
}
