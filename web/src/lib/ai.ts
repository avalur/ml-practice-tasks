import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import { sanitizeDeck } from "@/lib/deck-sanitize";
import { AI_PROVIDERS, type AiMode, type AiProviderId } from "./ai-shared";

export * from "./ai-shared";

/* The AI deck builder's server half.
 *
 * Two ways to pay for a request:
 *   - the platform's model, configured by env — GEMINI_API_KEY first,
 *     OPENROUTER_API_KEY next (by default Z.ai's GLM-5.3, a paid model: the
 *     OpenRouter account needs credit). Shared by every teacher, so capped per
 *     teacher per day (AI_DAILY_LIMIT, default 20) and in total
 *     (AI_GLOBAL_DAILY_LIMIT, 500).
 *   - the teacher's own key (AiCredential), any OpenAI-compatible provider,
 *     never capped by us.
 * The answer is streamed: a whole deck from a reasoning model takes minutes,
 * and the teacher watches it think and write rather than a spinner. Whatever
 * comes back is only ever slides, and it goes through the same sanitizer as a
 * hand-typed deck before anyone sees it. */

type Endpoint = { baseUrl: string; key: string; model: string; label: string };

/** How long one request may run, end to end — the route's maxDuration is 300 s,
 * and the answer must still be sanitized and sent inside it. */
export const AI_TIMEOUT_MS = 285_000;
export const DEFAULT_OPENROUTER_MODEL = "z-ai/glm-5.3";

export function platformEndpoints(): Endpoint[] {
  const out: Endpoint[] = [];
  if (process.env.GEMINI_API_KEY) {
    out.push({
      baseUrl: AI_PROVIDERS.gemini.baseUrl,
      key: process.env.GEMINI_API_KEY,
      model: process.env.AI_GEMINI_MODEL || "gemini-2.5-flash",
      label: "Gemini (free tier)",
    });
  }
  if (process.env.OPENROUTER_API_KEY) {
    out.push({
      baseUrl: AI_PROVIDERS.openrouter.baseUrl,
      key: process.env.OPENROUTER_API_KEY,
      model: process.env.AI_OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
      label: "OpenRouter",
    });
  }
  return out;
}

export const dailyLimit = () => Number(process.env.AI_DAILY_LIMIT || 20);
const globalLimit = () => Number(process.env.AI_GLOBAL_DAILY_LIMIT || 500);
export const today = () => new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------ key storage

function secretKey(): Buffer {
  const secret = process.env.AI_KEY_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("AI_KEY_SECRET (or AUTH_SECRET) must be set to store API keys");
  return Buffer.from(hkdfSync("sha256", secret, "mlp-ai-credential", "aes-256-gcm", 32));
}

export function encryptKey(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decryptKey(stored: string): string {
  const raw = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

/** A custom base URL is fetched from our server, so it must not point inside
 * our network. https only, no private or loopback hosts — unless
 * AI_ALLOW_PRIVATE_BASE_URL=1, which exists for the e2e mock and local models. */
export function checkBaseUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "not a URL";
  }
  if (process.env.AI_ALLOW_PRIVATE_BASE_URL === "1") return null;
  if (u.protocol !== "https:") return "must be https";
  const h = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".internal") ||
    h.endsWith(".local") ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) ||
    h === "::1" ||
    /^(fc|fd|fe80)/.test(h)
  ) {
    return "private addresses are not allowed";
  }
  return null;
}

// --------------------------------------------------------------- prompting

const DIALECT = `You write lecture slides for reveal.js as plain HTML.
Output ONLY a sequence of <section>...</section> elements — no <html>, <head>, <body>, no markdown, no code fences, no commentary.
Allowed: headings, p, ul/ol/li, strong/em, code/pre (use <pre><code class="language-python">), blockquote, table, img, a, div/span with classes, aside class="notes" for speaker notes.
Use class="fragment" on list items to reveal them one by one. Write formulas in LaTeX between $...$ (inline) or $$...$$ (display).
For Python the class can run in the browser, use <script type="py-editor">code</script> (add env="name" to editors that share variables across slides); the student presses Run. Only the standard library is available.
Never use any other <script>, nor <style>, <iframe>, <form>, <input>, <svg>, event handlers, or images from the web.
Keep each slide short: a title (h2 or h3) and at most 5–6 bullets or one small code block. The slide is 1280x720.`;

export function buildMessages(opts: {
  mode: AiMode;
  prompt: string;
  courseTitle: string;
  lessonTitle: string;
  currentDeck: string;
  slides: number;
  language: string;
}) {
  const system = { role: "system", content: DIALECT };
  if (opts.mode === "generate") {
    return [
      system,
      {
        role: "user",
        content:
          `Course: ${opts.courseTitle}\nLesson: ${opts.lessonTitle}\n` +
          `Write about ${opts.slides} slides in ${opts.language}.\n\nWhat the lesson should cover:\n${opts.prompt}`,
      },
    ];
  }
  return [
    system,
    {
      role: "user",
      content:
        `Here is the current deck for the lesson "${opts.lessonTitle}" of the course "${opts.courseTitle}":\n\n` +
        `${opts.currentDeck}\n\nRevise it as follows, and return the complete revised deck:\n${opts.prompt}`,
    },
  ];
}

/** The model's answer, reduced to slides and sanitized. Null when nothing
 * slide-shaped came back. */
export function extractDeck(answer: string): string | null {
  const text = answer.replace(/```(?:html)?/gi, "");
  const start = text.search(/<section\b/i);
  const end = text.toLowerCase().lastIndexOf("</section>");
  if (start < 0 || end < start) return null;
  return sanitizeDeck(text.slice(start, end + "</section>".length));
}

class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** What the browser is told while a request runs: the model's reasoning and
 * its answer as they arrive, then the sanitized deck or an error. */
export type AiEvent =
  | { type: "start"; via: string }
  | { type: "reasoning"; text: string }
  | { type: "text"; text: string }
  | { type: "done"; deck: string; via: string; remaining: number | null }
  | { type: "error"; error: string };

type Delta = { type: "reasoning" | "text"; text: string };

/** One streamed chat completion. Calls `onDelta` for every piece of reasoning
 * or answer text and resolves with the whole answer. A provider that ignores
 * `stream` and answers with plain JSON is accepted too. */
async function complete(
  ep: Endpoint,
  messages: { role: string; content: string }[],
  onDelta: (d: Delta) => void,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
  const openrouter = ep.baseUrl.startsWith(AI_PROVIDERS.openrouter.baseUrl);
  let answer = "";
  try {
    const res = await fetch(`${ep.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ep.key}` },
      body: JSON.stringify({
        model: ep.model,
        messages,
        temperature: 0.4,
        // Reasoning tokens count against this on most providers.
        max_tokens: 32_000,
        stream: true,
        // Slides need some thought, not a research plan: low effort keeps a
        // reasoning model inside the time limit. OpenRouter only — other
        // providers reject fields they do not know.
        ...(openrouter ? { reasoning: { effort: process.env.AI_REASONING_EFFORT || "low" } } : {}),
      }),
    });
    if (!res.ok) {
      const text = (await res.text().catch(() => "")).slice(0, 300);
      throw new ProviderError(`${ep.label} answered ${res.status}${text ? `: ${text}` : ""}`, res.status === 429 || res.status >= 500);
    }
    if (!(res.headers.get("content-type") ?? "").includes("text/event-stream") || !res.body) {
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      answer = data.choices?.[0]?.message?.content ?? "";
      if (answer) onDelta({ type: "text", text: answer });
    } else {
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          // ":" lines are keep-alive comments (OpenRouter sends them while it waits).
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          let chunk: {
            error?: { message?: string };
            choices?: { delta?: { content?: string; reasoning?: string; reasoning_content?: string } }[];
          };
          try {
            chunk = JSON.parse(payload);
          } catch {
            continue;
          }
          if (chunk.error) throw new ProviderError(`${ep.label}: ${chunk.error.message ?? "error"}`, !answer);
          const delta = chunk.choices?.[0]?.delta;
          const thought = delta?.reasoning ?? delta?.reasoning_content;
          if (thought) onDelta({ type: "reasoning", text: thought });
          if (delta?.content) {
            answer += delta.content;
            onDelta({ type: "text", text: delta.content });
          }
        }
      }
    }
    if (!answer) throw new ProviderError(`${ep.label} returned no text`, true);
    return answer;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(
      (e as Error).name === "AbortError"
        ? `${ep.label} · ${ep.model} did not finish in ${Math.round(AI_TIMEOUT_MS / 60_000)} minutes`
        : `${ep.label} unreachable`,
      // A request that already wrote half a deck is not worth repeating elsewhere.
      !answer,
    );
  } finally {
    clearTimeout(timer);
  }
}

export type AiPlan =
  | { ok: true; run: (messages: { role: string; content: string }[], emit: (e: AiEvent) => void) => Promise<void> }
  | { ok: false; status: number; error: string };

/** Everything that can be refused before a byte is streamed — no key, no
 * quota, a bad endpoint — so the route can still answer it with a status
 * code. The returned `run` streams one request and never throws. */
export async function planDeckRequest(userId: string): Promise<AiPlan> {
  const day = today();
  const cred = await prisma.aiCredential.findUnique({ where: { userId } });

  if (cred) {
    const provider = AI_PROVIDERS[cred.provider as AiProviderId];
    const ep: Endpoint = {
      baseUrl: cred.provider === "custom" ? cred.baseUrl ?? "" : provider?.baseUrl ?? "",
      key: decryptKey(cred.keyCipher),
      model: cred.model,
      label: provider?.label ?? cred.provider,
    };
    if (cred.provider === "custom") {
      const bad = checkBaseUrl(ep.baseUrl);
      if (bad) return { ok: false, status: 400, error: `Your endpoint address is not usable: ${bad}` };
    }
    const via = `${ep.label} · ${ep.model} (your key)`;
    return {
      ok: true,
      run: async (messages, emit) => {
        emit({ type: "start", via });
        try {
          const deck = extractDeck(await complete(ep, messages, (d) => emit(d)));
          await prisma.aiUsage.upsert({
            where: { userId_day: { userId, day } },
            create: { userId, day, own: 1 },
            update: { own: { increment: 1 } },
          });
          emit(deck ? { type: "done", deck, via, remaining: null } : { type: "error", error: "The model did not return any slides. Try rephrasing." });
        } catch (e) {
          emit({ type: "error", error: (e as Error).message });
        }
      },
    };
  }

  const endpoints = platformEndpoints();
  if (endpoints.length === 0) {
    return { ok: false, status: 501, error: "The site has no AI model configured. Add your own key in Studio → AI settings." };
  }

  // Reserve a slot first, refund it if nothing useful came back: two tabs
  // pressing the button at once must not both slip under the limit.
  const usage = await prisma.aiUsage.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, platform: 1 },
    update: { platform: { increment: 1 } },
  });
  const refund = () =>
    prisma.aiUsage.update({ where: { userId_day: { userId, day } }, data: { platform: { decrement: 1 } } });
  if (usage.platform > dailyLimit()) {
    await refund();
    return {
      ok: false,
      status: 429,
      error: `You have used today's ${dailyLimit()} requests to the site's model. They renew at midnight UTC — or add your own key in AI settings.`,
    };
  }
  const total = await prisma.aiUsage.aggregate({ where: { day }, _sum: { platform: true } });
  if ((total._sum.platform ?? 0) > globalLimit()) {
    await refund();
    return { ok: false, status: 429, error: "The site's AI budget for today is used up. Try tomorrow, or add your own key." };
  }
  const remaining = Math.max(0, dailyLimit() - usage.platform);

  return {
    ok: true,
    run: async (messages, emit) => {
      let lastError = "no provider answered";
      for (const ep of endpoints) {
        const via = `${ep.label} · ${ep.model}`;
        emit({ type: "start", via });
        try {
          const deck = extractDeck(await complete(ep, messages, (d) => emit(d)));
          if (!deck) {
            await refund();
            emit({ type: "error", error: "The model did not return any slides. Try rephrasing." });
            return;
          }
          emit({ type: "done", deck, via, remaining });
          return;
        } catch (e) {
          lastError = (e as Error).message;
          if (!(e as ProviderError).retryable) break;
        }
      }
      await refund();
      emit({ type: "error", error: lastError });
    },
  };
}
