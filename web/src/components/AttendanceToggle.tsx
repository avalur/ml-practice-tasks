"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AttendanceToggle({
  classSlug,
  lessonSlug,
  userId,
  initialAttended,
  studentName,
}: {
  classSlug: string;
  lessonSlug: string;
  userId: string;
  initialAttended: boolean;
  studentName?: string;
}) {
  const router = useRouter();
  const [attended, setAttended] = useState(initialAttended);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !attended;
    setAttended(next);
    setBusy(true);

    try {
      const res = await fetch(`/api/classes/${classSlug}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonSlug,
          userId,
          attended: next,
        }),
      });
      if (!res.ok) {
        // Revert on error
        setAttended(!next);
      } else {
        router.refresh();
      }
    } catch {
      setAttended(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <label
      className={`att-toggle ${attended ? "att-present" : "att-absent"} ${busy ? "att-busy" : ""}`}
      title={`${studentName ? `${studentName}: ` : ""}${attended ? "Присутствовал (нажмите чтобы снять)" : "Отсутствовал (нажмите чтобы отметить)"}`}
    >
      <input
        type="checkbox"
        className="att-checkbox"
        checked={attended}
        disabled={busy}
        onChange={toggle}
        data-testid={`att-${userId}-${lessonSlug}`}
        aria-label={`Посещаемость: ${studentName ?? userId}`}
      />
      <span className="att-label">{attended ? "✓" : "·"}</span>
    </label>
  );
}
