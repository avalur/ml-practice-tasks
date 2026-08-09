"use client";

import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";

/* Upload bridge for present mode.
 *
 * The lecture deck is a standalone static page (web/public/classes/…/present.html)
 * with no bundler, so it cannot import @vercel/blob/client — and the PDF cannot be
 * POSTed to a route either, because it exceeds Vercel's 4.5 MB request-body cap.
 *
 * So present.html opens this page in a hidden same-origin iframe and hands the
 * Blob over with postMessage (structured clone moves a Blob natively), and this
 * component does the real client upload. The teacher's cookies come along, so the
 * token route can check that they actually teach this class.
 *
 * Doing it in the iframe has a second, hard-won benefit: clicking `<a download>`
 * in the parent aborts requests started in *that* document, which once silently
 * swallowed the finish call. A separate browsing context is immune.
 */

type UploadMessage = {
  type: "mlp-blob-upload";
  blob: Blob;
  pathname: string;
  classSlug: string;
  sessionId: string;
};

function isUploadMessage(data: unknown): data is UploadMessage {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    d.type === "mlp-blob-upload" &&
    d.blob instanceof Blob &&
    typeof d.pathname === "string" &&
    typeof d.classSlug === "string" &&
    typeof d.sessionId === "string"
  );
}

export default function BlobBridgePage() {
  const [state, setState] = useState("waiting for a file…");

  useEffect(() => {
    const origin = window.location.origin;
    const reply = (msg: Record<string, unknown>) =>
      window.parent.postMessage(msg, origin);

    let busy = false;

    async function onMessage(event: MessageEvent) {
      if (event.origin !== origin || event.source !== window.parent) return;
      if (!isUploadMessage(event.data) || busy) return;
      busy = true;

      const { blob, pathname, classSlug, sessionId } = event.data;
      setState(`uploading ${Math.round(blob.size / 1024)} KB…`);
      try {
        const result = await upload(pathname, blob, {
          // Private store: the resulting URL answers 403 to everyone, and the
          // class reaches the file through .../lessons/<lesson>/notes, which
          // checks membership and signs a short-lived link.
          access: "private",
          contentType: "application/pdf",
          handleUploadUrl: "/api/blob/upload-token",
          clientPayload: JSON.stringify({ classSlug, sessionId }),
          onUploadProgress: (p) =>
            reply({ type: "mlp-blob-progress", percentage: p.percentage }),
        });
        setState("uploaded");
        reply({ type: "mlp-blob-done", url: result.url });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        setState(`failed: ${error}`);
        reply({ type: "mlp-blob-error", error });
      }
    }

    window.addEventListener("message", onMessage);
    reply({ type: "mlp-blob-ready" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Visible only if someone opens this page directly; in present mode the iframe
  // is 0×0 and off-screen.
  return (
    <p className="muted" data-testid="blob-bridge-state">
      Lecture-notes upload bridge — {state}
    </p>
  );
}
