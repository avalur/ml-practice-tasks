"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";

import { ThemeToggle } from "@/components/ThemeToggle";

/* The header is a client component on purpose. Reading the session on the
 * server in the root layout would make every page dynamic — the problem pages
 * are statically generated — and cost a database read per request. So the
 * account corner fills in after hydration, behind a fixed-size placeholder so
 * nothing shifts when it does. */

const NAV = [
  { href: "/problems", label: "Problems" },
  { href: "/notebooks", label: "Notebooks" },
  { href: "/classes", label: "Classes" },
  { href: "/brainteasers", label: "Brainteasers" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  // A navigation closes the mobile menu.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className={`site-header${open ? " nav-open" : ""}`}>
      <Link href="/" className="brand" aria-label="ML Practice — home">
        <span className="brand-mark" aria-hidden>
          ∂
        </span>
        ML&nbsp;Practice
      </Link>
      <button
        type="button"
        className="nav-burger"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>{open ? "✕" : "☰"}</span>
      </button>
      <nav className="nav-links" id="site-nav" aria-label="Main">
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="nav-link"
            aria-current={isActive(pathname, href) ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="header-right">
        <ThemeToggle />
        <AccountMenu pathname={pathname} />
      </div>
    </header>
  );
}

function initials(name: string | null | undefined, email: string | null | undefined) {
  return (name || email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

export function AccountMenu({ pathname }: { pathname: string }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status === "loading") return <span className="account-placeholder" aria-hidden />;

  if (!session?.user) {
    // Our own page rather than signIn(): it offers a password as well as the
    // two OAuth providers, and it comes back to where you were.
    const next =
      pathname && !pathname.startsWith("/signin") && !pathname.startsWith("/register")
        ? `?next=${encodeURIComponent(pathname)}`
        : "";
    return (
      <Link className="btn small primary" href={`/signin${next}`}>
        Sign in
      </Link>
    );
  }

  const { name, email, image, isAdmin } = session.user;
  return (
    <div className="account" ref={root}>
      <button
        type="button"
        className="account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid="account-menu"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="avatar" />
        ) : (
          <span className="avatar avatar-initials" aria-hidden>
            {initials(name, email)}
          </span>
        )}
        <span className="auth-name">{name ?? email}</span>
        <span className="account-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-menu-head">
            <div className="account-menu-name">{name ?? email}</div>
            {name && email && <div className="account-menu-email">{email}</div>}
          </div>
          <Link role="menuitem" href="/profile">
            Dashboard
          </Link>
          <Link role="menuitem" href="/profile/assignments">
            Assignments
          </Link>
          <Link role="menuitem" href="/profile/submissions">
            Submissions
          </Link>
          <Link role="menuitem" href="/profile/classes">
            My classes
          </Link>
          <div className="account-menu-sep" />
          <Link role="menuitem" href="/teach">
            Teaching
          </Link>
          {isAdmin && (
            <Link role="menuitem" href="/admin">
              Admin
            </Link>
          )}
          <Link role="menuitem" href="/profile/account">
            Account settings
          </Link>
          <div className="account-menu-sep" />
          <button role="menuitem" type="button" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
