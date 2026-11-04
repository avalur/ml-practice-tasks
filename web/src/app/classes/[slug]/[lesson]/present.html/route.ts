import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import { getAccess } from "@/lib/classes";
import { sanitizeDeck } from "@/lib/deck-sanitize";
import { deckCsp, renderDeckPage } from "@/lib/deck-shell";
import { deckHash } from "@/lib/studio";

/* GET /classes/<slug>/<lesson>/present.html for a studio course.
 *
 * Repo courses never reach this handler: their present.html is a static file
 * under public/, and Next serves public files before dynamic routes. So this
 * only ever renders decks that live in the database — under the same URL, which
 * is why the Present button, annotate.js and the PDF export need no changes.
 *
 * Unlike the static decks, a studio deck goes through the class's visibility
 * gate: a draft or suspended course is 404 here too. The deck was sanitized
 * when it was saved and is sanitized again on the way out, so a tightening of
 * the sanitizer also covers decks written before it. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; lesson: string }> },
) {
  const { slug, lesson } = await params;
  const notFound = () =>
    new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });

  const access = await getAccess(slug);
  if (!access.classRow || !access.visible) return notFound();

  const row = await prisma.studioLesson.findFirst({
    where: { slug: lesson, class: { slug, source: "studio" } },
    select: { title: true, deck: true },
  });
  if (!row) return notFound();

  const nonce = randomBytes(16).toString("base64");
  const deck = sanitizeDeck(row.deck);
  const html = renderDeckPage({
    classSlug: slug,
    classTitle: access.classRow.title,
    lessonSlug: lesson,
    lessonTitle: row.title,
    deck,
    deckHash: deckHash(row.deck),
    nonce,
  });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": deckCsp(nonce),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      // The nonce changes per response, so nothing here may be cached.
      "Cache-Control": "no-store",
    },
  });
}
