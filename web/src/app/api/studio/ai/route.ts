import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody, siteOrigin } from "@/lib/http";
import { editableClass } from "@/lib/studio";
import { buildMessages, planDeckRequest, type AiEvent, type AiSource } from "@/lib/ai";
import { findDeckRefs } from "@/lib/deck-convert";
import { importLessonDeck, type ImportedDeck } from "@/lib/deck-import";

// A reasoning model rewriting a whole deck can take minutes (AI_TIMEOUT_MS).
export const maxDuration = 300;

/* POST { course, lesson, mode: "generate" | "edit", prompt, slides?, language? }
 *
 * Anything refused up front (bad input, no model, quota) is a JSON error with
 * its status. Otherwise the answer is a stream of newline-delimited JSON
 * AiEvents — start, the model's reasoning and text as they arrive, then
 * `done` with the sanitized deck or `error` — so the editor can show progress.
 * Nothing is saved: the teacher reads it, and pressing Save is what makes it
 * the lesson's slides.
 *
 * A link to one of this site's lessons in the prompt is read here, before the
 * model is asked: a model cannot open links, and asked to copy one it invents
 * a deck. The lesson's slides go to the model numbered, and it may answer with
 * references to them (see SOURCE_RULES), which are expanded into the exact
 * slides — so "copy this lesson" is a short answer and a faithful copy. Its
 * images and data files are copied into the course's assets at this point. */
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

  const origin = siteOrigin(req);
  const hosts = [new URL(origin).host, new URL(req.url).host, "www.mlpractice.com", "mlpractice.com"];
  const refs = findDeckRefs(prompt, hosts);
  if (refs.length > 1) {
    return NextResponse.json({ error: "Link one lesson per request — the model can work from one at a time." }, { status: 400 });
  }
  let imported: ImportedDeck | null = null;
  if (refs.length === 1) {
    const got = await importLessonDeck(refs[0], { origin, targetClassId: g.cls.id });
    if (!got.ok) return NextResponse.json({ error: got.error }, { status: 422 });
    imported = got;
  }
  const source: AiSource | undefined = imported ? { url: refs[0].url, title: imported.title, sections: imported.sections } : undefined;

  const plan = await planDeckRequest(g.userId);
  if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: plan.status });
  const messages = buildMessages({ mode, prompt, courseTitle: g.cls.title, lessonTitle: lesson.title, currentDeck, slides, language, source });

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      // Reasoning arrives a few characters at a time; batching it into one
      // line per ~250 ms keeps the stream (and the browser's re-renders) small.
      let pending: { type: "reasoning" | "text"; text: string } | null = null;
      const send = (e: AiEvent) => ctrl.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      const flush = () => {
        if (pending) send(pending);
        pending = null;
      };
      const ticker = setInterval(flush, 250);
      try {
        if (imported) {
          send({ type: "source", title: imported.title, slides: imported.sections.length, images: imported.images, files: imported.files });
        }
        await plan.run(messages, (e) => {
          if (e.type === "reasoning" || e.type === "text") {
            if (pending && pending.type !== e.type) flush();
            pending = pending ? { type: e.type, text: pending.text + e.text } : { type: e.type, text: e.text };
          } else {
            flush();
            send(e);
          }
        }, imported?.sections);
      } finally {
        clearInterval(ticker);
        flush();
        ctrl.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
