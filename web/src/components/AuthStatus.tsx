"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export function AuthStatus() {
  const { data: session, status } = useSession();

  if (status === "loading") return <span className="muted">…</span>;

  if (session?.user) {
    return (
      <span className="auth-status">
        {session.user.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="avatar" />
        )}
        <span className="auth-name">{session.user.name ?? session.user.email}</span>
        <button className="btn small" onClick={() => signOut()}>
          Sign out
        </button>
      </span>
    );
  }

  return (
    <button className="btn small" onClick={() => signIn()}>
      Sign in
    </button>
  );
}
