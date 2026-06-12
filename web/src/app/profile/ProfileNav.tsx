import Link from "next/link";

const NAV = [
  { tab: "favorites",   icon: "⭐", label: "Favorites" },
  { tab: "submissions", icon: "📋", label: "Submissions" },
] as const;

const COMING_SOON = [
  { icon: "📚", label: "Study Plan" },
  { icon: "🗂", label: "Library" },
] as const;

export function ProfileNav({
  activeTab,
  name,
  email,
  streak,
  solvedCount,
  totalCount,
}: {
  activeTab: string;
  name: string | null;
  email: string | null;
  streak: number;
  solvedCount: number;
  totalCount: number;
}) {
  const initials = (name ?? email ?? "?")
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  return (
    <aside className="profile-sidebar">
      <div className="profile-avatar">{initials}</div>
      <p className="profile-name">{name ?? email}</p>
      {email && name && <p className="profile-email muted">{email}</p>}
      <p className="profile-stats">
        {streak > 0 && <span className="streak">🔥 {streak}-day streak &nbsp;</span>}
        <span className="result-good">{solvedCount}/{totalCount} solved</span>
      </p>

      <nav className="profile-nav">
        {NAV.map(({ tab, icon, label }) => (
          <Link
            key={tab}
            href={`/profile?tab=${tab}`}
            className={`profile-nav-link${activeTab === tab ? " active" : ""}`}
          >
            <span>{icon}</span>
            {label}
          </Link>
        ))}
        {COMING_SOON.map(({ icon, label }) => (
          <span key={label} className="profile-nav-link disabled">
            <span>{icon}</span>
            {label}
            <span className="badge soon-badge">soon</span>
          </span>
        ))}
      </nav>
    </aside>
  );
}
