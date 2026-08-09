"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

/* The four password screens. All of them talk to /api/account/*, which sets the
 * same session cookie Auth.js reads, so a password session and a Google session
 * are the same thing from every other page's point of view.
 *
 * On success they navigate with a full page load rather than the router: the
 * header's <SessionProvider> caches the session it fetched, and a client-side
 * push would leave it showing "Sign in" to somebody who just signed in.
 */

function useAfterAuth(): string {
  const params = useSearchParams();
  const next = params.get("next");
  // Only same-site paths: "next" comes from the URL bar.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/profile";
}

function Err({ children }: { children: React.ReactNode }) {
  return children ? <p className="class-join-err">{children}</p> : null;
}

async function post(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, string> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

function OAuthButtons({ next }: { next: string }) {
  return (
    <div className="auth-oauth">
      <button className="btn" onClick={() => signIn("google", { callbackUrl: next })}>
        Continue with Google
      </button>
      <button className="btn" onClick={() => signIn("github", { callbackUrl: next })}>
        Continue with GitHub
      </button>
    </div>
  );
}

export function SignInForm() {
  const next = useAfterAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    const { ok, data } = await post("/api/account/login", { email, password });
    if (ok) window.location.assign(next);
    else {
      setErr(data.error ?? "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <OAuthButtons next={next} />
      <div className="auth-or">or with an email and password</div>
      <form onSubmit={submit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <Err>{err}</Err>
      <p className="muted auth-links">
        <Link href="/forgot-password">Forgot your password?</Link>
        {" · "}
        <Link href="/register">Create an account</Link>
      </p>
    </div>
  );
}

export function RegisterForm() {
  const next = useAfterAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    const { ok, data } = await post("/api/account/register", { name, email, password });
    if (ok) window.location.assign(next);
    else {
      setErr(data.error ?? "Could not create the account.");
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <OAuthButtons next={next} />
      <div className="auth-or">or with an email and password</div>
      <form onSubmit={submit}>
        <label htmlFor="name">Name (shown to your teacher)</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={80}
        />
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label htmlFor="password">Password (at least 8 characters)</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <Err>{err}</Err>
      <p className="muted auth-links">
        Already have an account? <Link href="/signin">Sign in</Link>
      </p>
    </div>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    const { ok, data } = await post("/api/account/forgot-password", { email });
    setBusy(false);
    if (ok) setSent(data.message ?? "Check your email.");
    else setErr(data.error ?? "Could not send the link.");
  }

  if (sent) {
    return (
      <div className="auth-card">
        <p data-testid="forgot-sent">{sent}</p>
        <p className="muted">
          The link works once and expires in an hour. Nothing arrived? Check spam,
          then <Link href="/forgot-password">try again</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <form onSubmit={submit}>
        <label htmlFor="email">Your email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Email me a link"}
        </button>
      </form>
      <Err>{err}</Err>
      <p className="muted auth-links">
        <Link href="/signin">Back to sign in</Link>
      </p>
    </div>
  );
}

export function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    const { ok, data } = await post("/api/account/reset-password", { token, password });
    if (ok) window.location.assign("/profile");
    else {
      setErr(data.error ?? "Could not set the password.");
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-card">
        <p className="class-join-err">This link is missing its token.</p>
        <p className="muted auth-links">
          <Link href="/forgot-password">Request a new link</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <form onSubmit={submit}>
        <label htmlFor="password">New password (at least 8 characters)</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Set password and sign in"}
        </button>
      </form>
      <Err>{err}</Err>
      <p className="muted">
        Setting a new password signs out every other device.
      </p>
    </div>
  );
}
