import { NextResponse } from "next/server";
import { get } from "@vercel/blob";

import { prisma } from "@/lib/db";
import { formatDate, getDownloadEndpoint } from "@/lib/classes-shared";
import {
  NotebookFormatError,
  parseNotebook,
  renderNotebookErrorPage,
  renderNotebookPage,
  type NotebookPageInfo,
} from "@/lib/notebook-render";
import { readableSubmission } from "@/lib/submission-access";
import { getBlobPathname } from "@/lib/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ slug: string; lesson: string; id: string }>;
};

/* The page is the student's content, so it is served in a sandbox: no
 * allow-scripts means nothing in it runs, and the document gets an opaque
 * origin — it is not this site and never sees its cookies. The rest closes
 * what the sanitizer already closes: nothing is loaded from anywhere (images
 * are data: URIs, math is MathML), nothing can be framed or posted.
 * allow-popups(-to-escape-sandbox) lets a link in a markdown cell open in a
 * normal tab; allow-downloads keeps the "Download .ipynb" link working. */
const NOTEBOOK_VIEW_CSP = [
  "sandbox allow-popups allow-popups-to-escape-sandbox allow-downloads",
  "default-src 'none'",
  "img-src data:",
  "style-src 'unsafe-inline'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": NOTEBOOK_VIEW_CSP,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "private, no-store",
};

/* GET — the submitted .ipynb rendered as a read-only page, to skim in a tab
 * without downloading and running it. Same readers as /download: the author
 * and the class's teachers; 404 for everyone else.
 *
 * The page is streamed one cell at a time: a buffered Vercel function response
 * caps at 4.5 MB, and a notebook full of plots passes that easily. */
export async function GET(_req: Request, { params }: RouteParams) {
  const { slug, lesson, id } = await params;

  const submission = await readableSubmission(slug, lesson, id);
  if (!submission) return NextResponse.json({ error: "not found" }, { status: 404 });

  const author = await prisma.user.findUnique({
    where: { id: submission.userId },
    select: { name: true, email: true },
  });
  const info: NotebookPageInfo = {
    title: submission.fileName,
    meta: [author?.name || author?.email || "", `Submitted ${formatDate(submission.submittedAt)}`],
    downloadHref: getDownloadEndpoint(slug, lesson, submission.id),
  };
  const page = (status: number, message: string) =>
    new Response(renderNotebookErrorPage(info, message), { status, headers: HEADERS });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return page(501, "No Blob store is configured on this server, so the notebook cannot be read.");
  }

  let text: string;
  try {
    const blob = await get(getBlobPathname(submission.fileUrl), { access: "private" });
    if (!blob || blob.statusCode !== 200) {
      return page(404, "The notebook file is missing from storage.");
    }
    text = await new Response(blob.stream).text();
  } catch (err) {
    console.error("[submission-view] could not read", submission.fileUrl, err);
    return page(503, "The notebook file is temporarily unavailable. Try again in a minute.");
  }

  let notebook;
  try {
    notebook = parseNotebook(text);
  } catch (err) {
    if (err instanceof NotebookFormatError) {
      return page(422, `${err.message} Use “Download .ipynb” to look at the file itself.`);
    }
    throw err;
  }

  const chunks = renderNotebookPage(notebook, info);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      // A few cells per pull: small enough to stream, big enough not to crawl.
      let batch = "";
      for (let i = 0; i < 8; i++) {
        const next = chunks.next();
        if (next.done) {
          if (batch) controller.enqueue(encoder.encode(batch));
          controller.close();
          return;
        }
        batch += next.value;
      }
      controller.enqueue(encoder.encode(batch));
    },
  });
  return new Response(stream, { status: 200, headers: HEADERS });
}
