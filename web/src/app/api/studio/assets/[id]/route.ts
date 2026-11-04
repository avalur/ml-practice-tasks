import { prisma } from "@/lib/db";

/* GET — one image a studio deck shows. Public by id (the id is a cuid, and the
 * decks that link it are themselves readable by anyone with the link), served
 * same-origin so the deck's CSP can say img-src 'self'. Immutable: an asset is
 * never rewritten, only added or deleted. Only raster types were accepted on
 * upload, and nosniff keeps the browser from guessing otherwise. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await prisma.studioAsset.findUnique({
    where: { id },
    select: { mime: true, bytes: true },
  });
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      "Content-Type": asset.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
