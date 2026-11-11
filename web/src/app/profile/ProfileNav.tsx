"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/profile", label: "Overview" },
  { href: "/profile/assignments", label: "Assignments" },
  { href: "/profile/submissions", label: "Submissions" },
  { href: "/profile/favorites", label: "Favorites" },
  { href: "/profile/classes", label: "Classes" },
  { href: "/profile/account", label: "Account" },
] as const;

export function ProfileNav({
  name,
  email,
  image,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
}) {
  const pathname = usePathname();
  const initials = (name || email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <aside className="profile-sidebar">
      <div className="profile-id">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="profile-avatar" />
        ) : (
          <div className="profile-avatar" aria-hidden>
            {initials}
          </div>
        )}
        <div className="profile-id-text">
          <p className="profile-name">{name ?? email}</p>
          {email && name && <p className="profile-email">{email}</p>}
        </div>
      </div>

      <nav className="profile-nav" aria-label="Your account">
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="profile-nav-link"
            aria-current={pathname === href ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
