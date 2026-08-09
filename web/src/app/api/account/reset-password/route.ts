import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, passwordProblem } from "@/lib/password";
import { crossSite, startSession } from "@/lib/session-cookie";

// POST { token, password } — set a new password and sign in.

export async function POST(req: Request) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  if (!token) return NextResponse.json({ error: "Missing link token." }, { status: 400 });
  const bad = passwordProblem(body.password);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    select: { id: true, userId: true, expiresAt: true, usedAt: true, user: { select: { email: true } } },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "This link has expired or was already used. Request a new one." },
      { status: 400 },
    );
  }

  const bad2 = passwordProblem(body.password, row.user.email ?? undefined);
  if (bad2) return NextResponse.json({ error: bad2 }, { status: 400 });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: {
        passwordHash: await hashPassword(body.password as string),
        failedLogins: 0,
        lockedUntil: null,
        // Following a link sent to that address is proof they own it. For an
        // account created with a password this is the moment it gets verified.
        emailVerified: new Date(),
      },
    }),
    // Every other link for this account dies with it…
    prisma.passwordResetToken.deleteMany({ where: { userId: row.userId } }),
    // …and so does every session, which is the point of a reset: whoever was
    // signed in with the old password is signed out.
    prisma.session.deleteMany({ where: { userId: row.userId } }),
  ]);

  const res = NextResponse.json({ ok: true });
  await startSession(res, req, row.userId);
  return res;
}
