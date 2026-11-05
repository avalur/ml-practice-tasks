import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crossSite } from "@/lib/http";
import { ASSET_MIME, STUDIO_LIMITS, editableClass, sniffImage } from "@/lib/studio";

/* POST multipart { file } — upload an image for this course's slides. Returns
 * the URL to put in an <img src>. Raster images only (see ASSET_MIME), checked
 * by magic bytes as well as by the declared type, since the declared type is
 * whatever the browser — or a script — said. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const { slug } = await params;
  const g = await editableClass(slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    file = null;
  }
  if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (file.size > STUDIO_LIMITS.assetBytes) {
    return NextResponse.json({ error: `Images are limited to ${STUDIO_LIMITS.assetBytes / 1024 / 1024} MB.` }, { status: 413 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(bytes);
  if (!mime || !(ASSET_MIME as readonly string[]).includes(mime)) {
    return NextResponse.json({ error: "PNG, JPEG, GIF or WebP only." }, { status: 415 });
  }

  const used = await prisma.studioAsset.aggregate({ where: { classId: g.cls.id }, _sum: { size: true } });
  if ((used._sum.size ?? 0) + bytes.length > STUDIO_LIMITS.assetsPerCourse) {
    return NextResponse.json({ error: "This course has used its image storage." }, { status: 409 });
  }

  const asset = await prisma.studioAsset.create({
    data: { classId: g.cls.id, mime, bytes, size: bytes.length, name: file.name.slice(0, 200) },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, url: `/api/studio/assets/${asset.id}` });
}
