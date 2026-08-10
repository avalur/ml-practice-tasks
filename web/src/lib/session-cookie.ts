import { randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/* Signing a user in without going through an OAuth provider.
 *
 * Auth.js is configured with **database** sessions, so a session is nothing but
 * a Session row plus a cookie holding its token — there is no JWT to mint. That
 * is what makes email+password possible here at all: Auth.js's own Credentials
 * provider refuses to run under the database strategy, but a row and a cookie
 * are exactly what its adapter reads back, so `auth()` treats these sessions as
 * its own (and its Sign out button ends them normally).
 */

const MAX_AGE_DAYS = 30;

/** Auth.js prefixes the cookie with __Secure- when the site is served over
 * https. Match it exactly, or the session it reads back will not be this one. */
export function sessionCookieName(req: Request): string {
  const proto =
    req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return proto === "https" ? "__Secure-authjs.session-token" : "authjs.session-token";
}

/** Create the session row and put its cookie on the response. */
export async function startSession(
  res: NextResponse,
  req: Request,
  userId: string,
): Promise<void> {
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { sessionToken, userId, expires } });

  const name = sessionCookieName(req);
  res.cookies.set(name, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: name.startsWith("__Secure-"),
    expires,
  });
}

/** Normalized form of an address, or null when it cannot be one. */
export function cleanEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) return null;
  return email;
}
