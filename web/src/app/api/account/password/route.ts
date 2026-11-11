import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody, rateLimited } from "@/lib/http";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { sessionCookieName } from "@/lib/session-cookie";

// POST { current, password } — change the password of the signed-in account.
//
// Only for an account that already has one. An OAuth-only account gets its
// first password through the reset-by-email flow, exactly as before: following
// a mailed link is what proves the address, and a signed-in browser left open
// is not the same proof.

const MAX_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

export async function POST(req: Request) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  if (rateLimited(req, "password-change", 20, 5 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  const current = typeof body.current === "string" ? body.current : "";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, passwordHash: true, failedLogins: true, lockedUntil: true },
  });
  if (!user?.passwordHash) {
    return NextResponse.json(
      { error: "This account has no password yet. Use “Forgot password” to set one." },
      { status: 400 },
    );
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return NextResponse.json(
      { error: "Too many wrong passwords. Try again later, or reset it by email." },
      { status: 429 },
    );
  }

  const bad = passwordProblem(body.password, user.email ?? undefined);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  // The same lockout as sign-in: a borrowed, still-signed-in browser must not
  // become a free password oracle.
  if (!(await verifyPassword(current, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLogins: failed,
        lockedUntil: failed >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
      },
    });
    return NextResponse.json({ error: "The current password is wrong." }, { status: 400 });
  }

  // Every other session ends, as on a reset: whoever knew the old password is
  // signed out. This one stays, so the person changing it is not.
  const token = (await cookies()).get(sessionCookieName(req))?.value ?? "";
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(body.password as string),
        failedLogins: 0,
        lockedUntil: null,
      },
    }),
    prisma.session.deleteMany({ where: { userId, NOT: { sessionToken: token } } }),
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
