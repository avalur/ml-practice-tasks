import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { editableClass } from "@/lib/studio";
import { buildMessages, generateDeck } from "@/lib/ai";

// A whole deck from a free model can take most of a minute.
export const maxDuration = 60;

/* POST { course, lesson, mode: "generate" | "edit", prompt, slides?, language? }
 *
 * Returns a sanitized deck for the editor to show. Nothing is saved: the
 * teacher reads it, and pressing Save is what makes it the lesson's slides. */
export async function POST(req: Request) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  const course = typeof body.course === "string" ? body.course : "";
  const g = await editableClass(course);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const lessonSlug = typeof body.lesson === "string" ? body.lesson : "";
  const lesson = await prisma.studioLesson.findUnique({
    where: { classId_slug: { classId: g.cls.id, slug: lessonSlug } },
    select: { title: true, deck: true },
  });
  if (!lesson) return NextResponse.json({ error: "no such lesson" }, { status: 404 });

  const mode = body.mode === "edit" ? "edit" : "generate";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < 5) return NextResponse.json({ error: "Say what the slides should be about." }, { status: 400 });
  if (prompt.length > 4000) return NextResponse.json({ error: "The request is too long." }, { status: 400 });
  const slides = Math.min(30, Math.max(3, Number(body.slides) || 10));
  const language = typeof body.language === "string" && body.language.trim() ? body.language.trim().slice(0, 40) : "English";
  // The editor may hold unsaved changes; editing works on what the teacher sees.
  const currentDeck = typeof body.deck === "string" && body.deck.length < 400_000 ? body.deck : lesson.deck;

  const outcome = await generateDeck(
    g.userId,
    buildMessages({ mode, prompt, courseTitle: g.cls.title, lessonTitle: lesson.title, currentDeck, slides, language }),
  );
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  return NextResponse.json(outcome);
}
