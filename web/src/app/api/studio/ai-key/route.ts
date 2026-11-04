import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { isPlatformTeacher } from "@/lib/teachers";
import { AI_PROVIDERS, type AiProviderId, checkBaseUrl, encryptKey } from "@/lib/ai";

async function teacherId(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.id;
  return id && (await isPlatformTeacher()) ? id : null;
}

/* POST { provider, model, key, baseUrl? } — store the teacher's own key.
 * The key is encrypted at rest and never returned; only its last four
 * characters are kept in the clear, to recognise it by. */
export async function POST(req: Request) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const userId = await teacherId();
  if (!userId) return NextResponse.json({ error: "teacher role required" }, { status: 403 });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  const provider = body.provider as AiProviderId;
  if (typeof provider !== "string" || !(provider in AI_PROVIDERS)) {
    return NextResponse.json({ error: "unknown provider" }, { status: 400 });
  }
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!model || model.length > 200) return NextResponse.json({ error: "Which model?" }, { status: 400 });
  if (key.length < 8 || key.length > 500) return NextResponse.json({ error: "That does not look like an API key." }, { status: 400 });
  let baseUrl: string | null = null;
  if (provider === "custom") {
    baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
    const bad = checkBaseUrl(baseUrl);
    if (bad) return NextResponse.json({ error: `Endpoint address: ${bad}` }, { status: 400 });
  }

  const data = { provider, model, baseUrl, keyCipher: encryptKey(key), keyHint: key.slice(-4) };
  await prisma.aiCredential.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return NextResponse.json({ ok: true });
}

/* DELETE — forget the key; the builder goes back to the free models. */
export async function DELETE(req: Request) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const userId = await teacherId();
  if (!userId) return NextResponse.json({ error: "teacher role required" }, { status: 403 });
  await prisma.aiCredential.deleteMany({ where: { userId } });
  return NextResponse.json({ ok: true });
}
