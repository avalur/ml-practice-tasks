"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

export function AuthStatus() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

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

  // Our own page rather than signIn(): it offers a password as well as the two
  // OAuth providers, and it comes back to where you were.
  const next =
    pathname && !pathname.startsWith("/signin") && !pathname.startsWith("/register")
      ? `?next=${encodeURIComponent(pathname)}`
      : "";
  return (
    <Link className="btn small" href={`/signin${next}`}>
      Sign in
    </Link>
  );
}
