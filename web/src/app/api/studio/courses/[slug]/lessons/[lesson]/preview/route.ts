import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import { crossSite } from "@/lib/http";
import { sanitizeDeck } from "@/lib/deck-sanitize";
import { deckCsp, hasPython, renderDeckPage } from "@/lib/deck-shell";
import { STUDIO_LIMITS, deckHash, editableClass } from "@/lib/studio";

type Ctx = { params: Promise<{ slug: string; lesson: string }> };

/* POST (form field `deck`) — the live preview of the full-screen editor: the
 * deck the teacher is typing, rendered exactly as present.html would render it
 * once saved, without saving it.
 *
 * It is a form POST into a named iframe rather than a fetch, so the preview is a
 * real document with this route's own CSP header — not a srcdoc or blob page
 * that would inherit the editor's origin with no policy of its own. Same
 * sanitizer, same shell, same CSP as the saved deck, so what the teacher sees
 * here is what students get. Only the course's editors may render: anyone else
 * could use it to put arbitrary (if sanitized) pages on this origin. */
export async function POST(req: Request, { params }: Ctx) {
  const text = (status: number, body: string) =>
    new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (crossSite(req)) return text(403, "bad origin");
  const { slug, lesson } = await params;
  const g = await editableClass(slug);
  if (!g.ok) return text(g.status, g.error);

  const row = await prisma.studioLesson.findUnique({
    where: { classId_slug: { classId: g.cls.id, slug: lesson } },
    select: { title: true },
  });
  if (!row) return text(404, "no such lesson");

  const form = await req.formData().catch(() => null);
  const raw = form?.get("deck");
  if (typeof raw !== "string") return text(400, "deck missing");
  // Twice the save limit: the preview should still show a deck that is a bit too
  // big to save (the save button says why), but not render anything at all.
  if (Buffer.byteLength(raw) > 2 * STUDIO_LIMITS.deckBytes) return text(413, "deck too large to preview");

  const nonce = randomBytes(16).toString("base64");
  const deck = sanitizeDeck(raw);
  const html = renderDeckPage({
    classSlug: slug,
    classTitle: g.cls.title,
    lessonSlug: lesson,
    lessonTitle: row.title,
    deck,
    deckHash: deckHash(raw),
    nonce,
    preview: true,
  });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": deckCsp(nonce, hasPython(deck)),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "Cache-Control": "no-store",
    },
  });
}
