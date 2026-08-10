import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { crossSite, jsonBody } from "@/lib/http";
import { cleanNamePart, displayName, nameProblem } from "@/lib/person";

// POST { firstName, lastName } — set the signed-in user's name.
//
// `name` is written alongside so rosters, the monitor feed and the header keep
// reading one field; the email is the fallback when both parts are cleared.
export async function POST(req: Request) {
  if (crossSite(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  const firstName = cleanNamePart(body.firstName);
  const lastName = cleanNamePart(body.lastName);
  if (!firstName && !lastName) {
    return NextResponse.json({ error: "Enter your first or last name." }, { status: 400 });
  }
  const tooLong = nameProblem(firstName, lastName);
  if (tooLong) return NextResponse.json({ error: tooLong }, { status: 400 });

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: firstName || null,
      lastName: lastName || null,
      name: displayName(firstName, lastName, session.user?.email ?? "Student"),
    },
    select: { name: true, firstName: true, lastName: true },
  });

  return NextResponse.json({ ok: true, ...user });
}
