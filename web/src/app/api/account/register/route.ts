import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, passwordProblem } from "@/lib/password";
import { cleanEmail, crossSite, startSession } from "@/lib/session-cookie";
import { cleanNamePart, displayName } from "@/lib/person";

// POST { email, password, firstName?, lastName? } — create an account and sign
// it in.
//
// Lives under /api/account rather than /api/auth so it cannot shadow anything
// Auth.js serves from its catch-all.
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
  const bad = passwordProblem(body.password, email);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  const firstName = cleanNamePart(body.firstName);
  const lastName = cleanNamePart(body.lastName);

  /* An address that already has an account is refused rather than adopted.
   * Adopting it would be an account takeover: sign in with Google once, and
   * anybody who knows the address could later "register" a password onto it.
   * Proving you own the address is what the reset-by-email flow is for, so that
   * is where the message points — it works for OAuth-only accounts too. */
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error:
          "That email already has an account. Sign in, or use “Forgot password” " +
          "to set a password for it.",
      },
      { status: 409 },
    );
  }

  const user = await prisma.user.create({
    data: {
      email,
      firstName: firstName || null,
      lastName: lastName || null,
      name: displayName(firstName, lastName, email.split("@")[0]),
      passwordHash: await hashPassword(body.password as string),
    },
    select: { id: true, name: true },
  });

  const res = NextResponse.json({ ok: true, name: user.name });
  await startSession(res, req, user.id);
  return res;
}
