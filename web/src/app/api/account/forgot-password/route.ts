import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resetEmail, sendMail } from "@/lib/mailer";
import { cleanEmail, crossSite } from "@/lib/session-cookie";

// POST { email } — email a reset link, if that address has an account.

// Not exported: a route file may only export handlers and Next's own config.
const TTL_MINUTES = 60;
const RESEND_GAP_MS = 60_000; // one letter a minute per account

/** The same answer whether or not the address is registered — the response to
 * this endpoint must not be a way to find out who has an account here. */
const SENT = { ok: true, message: "If that email has an account, a reset link is on its way." };

export async function POST(req: Request) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const email = cleanEmail(body.email);
  if (!email) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return NextResponse.json(SENT);

  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - RESEND_GAP_MS) } },
    select: { id: true },
  });
  if (recent) return NextResponse.json(SENT); // silently: same answer as always

  // The token goes out by email; only its hash is kept, so a leaked database
  // cannot be turned into working reset links.
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000),
    },
  });

  const origin = new URL(req.url).origin;
  const link = `${origin}/reset-password?token=${token}`;
  await sendMail({ to: email, ...resetEmail(link, TTL_MINUTES) });

  return NextResponse.json(SENT);
}
