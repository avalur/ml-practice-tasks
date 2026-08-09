import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/lib/db";
import { getAccess } from "@/lib/classes";

/* Mints a short-lived client token so the browser can PUT the lecture PDF
 * straight to Vercel Blob.
 *
 * The upload cannot go through this function: a Vercel serverless request body
 * is capped at 4.5 MB and a 36-slide deck already measured 4.9 MB (the 61-slide
 * decision_trees deck would be ~8 MB). So the file never touches our server —
 * only this token does.
 *
 * `onUploadCompleted` is deliberately not used. It makes the Blob service call
 * back into this route, which requires a publicly reachable URL and therefore
 * never fires on localhost. The browser reports the resulting URL to
 * .../sessions/<id>/finish instead, which works identically in both places.
 */
export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "no Blob store is configured (BLOB_READ_WRITE_TOKEN is unset)" },
      { status: 501 },
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload ?? "{}") as {
          classSlug?: string;
          sessionId?: string;
        };
        if (!payload.classSlug || !payload.sessionId) {
          throw new Error("clientPayload must carry classSlug and sessionId");
        }

        // Only a teacher of this class, and only for a session of this class:
        // the token this returns is a write capability, so it is scoped to one
        // lesson folder and one content type.
        const access = await getAccess(payload.classSlug);
        if (!access.classRow) throw new Error("no such class");
        if (!access.isTeacher) throw new Error("forbidden");

        const lessonSession = await prisma.lessonSession.findFirst({
          where: { id: payload.sessionId, classId: access.classRow.id },
          select: { lessonSlug: true },
        });
        if (!lessonSession) throw new Error("no such lesson session");

        const prefix = `classes/${payload.classSlug}/${lessonSession.lessonSlug}/`;
        if (!pathname.startsWith(prefix) || pathname.includes("..")) {
          throw new Error(`pathname must sit under ${prefix}`);
        }

        return {
          allowedContentTypes: ["application/pdf"],
          // Unguessable URL: Blob serves public objects to anyone holding the
          // link, and the link is only ever shown on the member-only lesson page.
          addRandomSuffix: true,
          maximumSizeInBytes: 64 * 1024 * 1024,
        };
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload token refused";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
