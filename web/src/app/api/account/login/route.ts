import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { cleanEmail, crossSite, startSession } from "@/lib/session-cookie";

// POST { email, password } — sign in with a password.

const MAX_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

/** One message for "no such account" and for "wrong password": which of the two
 * it is would tell a stranger whether an address is registered here. */
const REFUSED = "Wrong email or password.";

export async function POST(req: Request) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const email = cleanEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: REFUSED }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, failedLogins: true, lockedUntil: true },
  });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.max(1, Math.ceil((+user.lockedUntil - Date.now()) / 60000));
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${minutes} min, or reset your password.` },
      { status: 429 },
    );
  }

  // Runs even when there is no such user, so a missing account and a wrong
  // password take the same time to answer.
  const ok = await verifyPassword(password, user?.passwordHash ?? null);

  if (!user || !ok) {
    if (user) {
      const failed = user.failedLogins + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: failed,
          lockedUntil:
            failed >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
        },
      });
    }
    return NextResponse.json({ error: REFUSED }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null },
  });

  const res = NextResponse.json({ ok: true });
  await startSession(res, req, user.id);
  return res;
}
