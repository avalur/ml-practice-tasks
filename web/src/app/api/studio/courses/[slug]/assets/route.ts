import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crossSite } from "@/lib/http";
import { ASSET_MIME, STUDIO_LIMITS, editableClass } from "@/lib/studio";

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
  const mime = sniff(bytes);
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

function sniff(b: Buffer): string | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 6 && /^GIF8[79]a$/.test(b.subarray(0, 6).toString("latin1"))) return "image/gif";
  if (b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}
