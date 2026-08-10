"use client";

import { useState } from "react";
import { NameFields } from "./AuthForms";

/* The Account tab's name editor. Saves with a full page load like the auth
 * forms do: the header's cached session would otherwise keep showing the old
 * name next to the avatar. */
export function ProfileNameForm({
  first,
  last,
  email,
}: {
  first: string;
  last: string;
  email: string | null;
}) {
  const [firstName, setFirstName] = useState(first);
  const [lastName, setLastName] = useState(last);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const dirty = firstName.trim() !== first || lastName.trim() !== last;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName }),
    });
    if (res.ok) window.location.assign("/profile?tab=account&saved=1");
    else {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Could not save your name.");
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <form onSubmit={submit}>
        <NameFields
          firstName={firstName}
          lastName={lastName}
          setFirstName={setFirstName}
          setLastName={setLastName}
        />
        <label htmlFor="account-email">Email</label>
        <input id="account-email" value={email ?? ""} disabled />
        <button className="btn primary" type="submit" disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
      {err && <p className="class-join-err">{err}</p>}
    </div>
  );
}
