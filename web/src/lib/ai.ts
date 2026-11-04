import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import { sanitizeDeck } from "@/lib/deck-sanitize";
import { AI_PROVIDERS, type AiMode, type AiProviderId } from "./ai-shared";

export * from "./ai-shared";

/* The AI deck builder's server half.
 *
 * Two ways to pay for a request:
 *   - the platform's free models, configured by env — GEMINI_API_KEY first,
 *     OPENROUTER_API_KEY as the fallback when Gemini refuses or is rate
 *     limited. Shared by every teacher, so capped per teacher per day
 *     (AI_DAILY_LIMIT, default 20) and in total (AI_GLOBAL_DAILY_LIMIT, 500).
 *     Free tiers may train on prompts; the Studio says so next to the button.
 *   - the teacher's own key (AiCredential), any OpenAI-compatible provider,
 *     never capped by us.
 * Whatever comes back is only ever slides, and it goes through the same
 * sanitizer as a hand-typed deck before anyone sees it. */

type Endpoint = { baseUrl: string; key: string; model: string; label: string };

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
      model: process.env.AI_OPENROUTER_MODEL || "openrouter/free",
      label: "OpenRouter (free models)",
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
Never use <script>, <style>, <iframe>, <form>, <input>, <svg>, event handlers, or images from the web.
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

async function complete(ep: Endpoint, messages: { role: string; content: string }[]): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55_000);
  try {
    const res = await fetch(`${ep.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ep.key}` },
      body: JSON.stringify({ model: ep.model, messages, temperature: 0.4, max_tokens: 8000 }),
    });
    if (!res.ok) {
      const text = (await res.text().catch(() => "")).slice(0, 300);
      throw new ProviderError(`${ep.label} answered ${res.status}${text ? `: ${text}` : ""}`, res.status === 429 || res.status >= 500);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new ProviderError(`${ep.label} returned no text`, true);
    return content;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(
      (e as Error).name === "AbortError" ? `${ep.label} took too long` : `${ep.label} unreachable`,
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}

export type AiOutcome =
  | { ok: true; deck: string; via: string; own: boolean; remaining: number | null }
  | { ok: false; status: number; error: string };

/** Run one request for a teacher: their own key if they set one, else the
 * platform's free models within quota. */
export async function generateDeck(
  userId: string,
  messages: { role: string; content: string }[],
): Promise<AiOutcome> {
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
    try {
      const deck = extractDeck(await complete(ep, messages));
      await prisma.aiUsage.upsert({
        where: { userId_day: { userId, day } },
        create: { userId, day, own: 1 },
        update: { own: { increment: 1 } },
      });
      if (!deck) return { ok: false, status: 502, error: "The model did not return any slides. Try rephrasing." };
      return { ok: true, deck, via: `${ep.label} · ${ep.model} (your key)`, own: true, remaining: null };
    } catch (e) {
      return { ok: false, status: 502, error: (e as Error).message };
    }
  }

  const endpoints = platformEndpoints();
  if (endpoints.length === 0) {
    return { ok: false, status: 501, error: "The site has no free model configured. Add your own key in Studio → AI settings." };
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
      error: `You have used today's ${dailyLimit()} free requests. They renew at midnight UTC — or add your own key in AI settings.`,
    };
  }
  const total = await prisma.aiUsage.aggregate({ where: { day }, _sum: { platform: true } });
  if ((total._sum.platform ?? 0) > globalLimit()) {
    await refund();
    return { ok: false, status: 429, error: "The site's free AI budget for today is used up. Try tomorrow, or add your own key." };
  }

  let lastError = "no provider answered";
  for (const ep of endpoints) {
    try {
      const deck = extractDeck(await complete(ep, messages));
      if (!deck) {
        await refund();
        return { ok: false, status: 502, error: "The model did not return any slides. Try rephrasing." };
      }
      return { ok: true, deck, via: `${ep.label} · ${ep.model}`, own: false, remaining: Math.max(0, dailyLimit() - usage.platform) };
    } catch (e) {
      lastError = (e as Error).message;
      if (!(e as ProviderError).retryable) break;
    }
  }
  await refund();
  return { ok: false, status: 502, error: lastError };
}
