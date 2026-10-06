"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AttendanceBatchButtons({
  classSlug,
  lessonSlug,
  userIds,
}: {
  classSlug: string;
  lessonSlug: string;
  userIds: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setAll(attended: boolean) {
    if (busy || userIds.length === 0) return;
    setBusy(true);

    try {
      const res = await fetch(`/api/classes/${classSlug}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonSlug,
          userIds,
          attended,
        }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="att-batch-actions">
      <button
        type="button"
        className="bt-clear-btn"
        disabled={busy || userIds.length === 0}
        onClick={() => setAll(true)}
        title="Mark all students in the group as present"
      >
        {busy ? "Saving…" : "Mark all"}
      </button>
      <button
        type="button"
        className="bt-clear-btn"
        disabled={busy || userIds.length === 0}
        onClick={() => setAll(false)}
        title="Clear attendance for all students"
      >
        {busy ? "Saving…" : "Clear all"}
      </button>
    </div>
  );
}
