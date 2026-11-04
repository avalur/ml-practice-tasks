import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { editableClass } from "@/lib/studio";
import { buildMessages, planDeckRequest, type AiEvent } from "@/lib/ai";

// A reasoning model rewriting a whole deck can take minutes (AI_TIMEOUT_MS).
export const maxDuration = 300;

/* POST { course, lesson, mode: "generate" | "edit", prompt, slides?, language? }
 *
 * Anything refused up front (bad input, no model, quota) is a JSON error with
 * its status. Otherwise the answer is a stream of newline-delimited JSON
 * AiEvents — start, the model's reasoning and text as they arrive, then
 * `done` with the sanitized deck or `error` — so the editor can show progress.
 * Nothing is saved: the teacher reads it, and pressing Save is what makes it
 * the lesson's slides. */
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

  const plan = await planDeckRequest(g.userId);
  if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: plan.status });
  const messages = buildMessages({ mode, prompt, courseTitle: g.cls.title, lessonTitle: lesson.title, currentDeck, slides, language });

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
        await plan.run(messages, (e) => {
          if (e.type === "reasoning" || e.type === "text") {
            if (pending && pending.type !== e.type) flush();
            pending = pending ? { type: e.type, text: pending.text + e.text } : { type: e.type, text: e.text };
          } else {
            flush();
            send(e);
          }
        });
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
