"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { APPLICATION_LIMITS } from "@/lib/teacher-shared";

/* The application to become a platform teacher. Three questions, answered for
 * a human reviewer — the site admin reads every one. */
export function TeacherApplyForm() {
  const router = useRouter();
  const [about, setAbout] = useState("");
  const [plans, setPlans] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/teach/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about, plans, link }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) router.refresh();
      else setErr(data.error ?? "Could not send the application.");
    } catch {
      setErr("Network error — try again.");
    }
    setBusy(false);
  }

  const ready = about.trim().length >= 20 && plans.trim().length >= 20;

  return (
    <form className="teach-form" onSubmit={submit} data-testid="teach-apply">
      <label>
        Who are you, and where do you teach?
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          maxLength={APPLICATION_LIMITS.about}
          rows={4}
          placeholder="e.g. I teach computer science at a secondary school in …"
          name="about"
        />
      </label>
      <label>
        What would you like to teach here, and to whom?
        <textarea
          value={plans}
          onChange={(e) => setPlans(e.target.value)}
          maxLength={APPLICATION_LIMITS.plans}
          rows={4}
          placeholder="e.g. An intro to Python and NumPy for my 10th grade, about 25 students"
          name="plans"
        />
      </label>
      <label>
        A link that tells us about you <span className="muted">(optional)</span>
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          maxLength={APPLICATION_LIMITS.link}
          placeholder="https://…"
          name="link"
        />
      </label>
      <div>
        <button type="submit" className="class-present-btn" disabled={busy || !ready}>
          {busy ? "Sending…" : "Apply to teach"}
        </button>
      </div>
      {err && <p className="class-join-err">{err}</p>}
    </form>
  );
}
