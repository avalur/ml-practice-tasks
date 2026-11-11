/* The site's UI primitives. Server-safe: no hooks, no "use client", so any page
 * can render them and a client component can import them too. Styles live in
 * src/styles/ui.css. */

import Link from "next/link";
import type { ReactNode } from "react";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/** A state ("published", "overdue", "graded"). Difficulty uses DifficultyBadge. */
export function Badge({
  tone = "neutral",
  children,
  className,
  testId,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <span className={cx("badge", `tone-${tone}`, className)} data-testid={testId}>
      {children}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  return <span className={`badge ${difficulty}`}>{difficulty}</span>;
}

export function Notice({
  tone = "info",
  title,
  children,
  testId,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <div className={cx("notice", `tone-${tone}`, className)} data-testid={testId} role="note">
      <div className="notice-body">
        {title && <div className="notice-title">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  actions,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  action,
  children,
  testId,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section className="section" data-testid={testId}>
      <div className="section-head">
        <h2>{title}</h2>
        {action && <span className="push">{action}</span>}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  children,
  action,
  testId,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  testId?: string;
}) {
  return (
    <div className="empty-state" data-testid={testId}>
      <p className="empty-state-title">{title}</p>
      {children && <p>{children}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

/** done/total as a bar. A total of 0 renders nothing: an empty bar reads as 0%. */
export function ProgressBar({
  done,
  total,
  label,
  tone,
  testId,
}: {
  done: number;
  total: number;
  label?: ReactNode;
  tone?: "success" | "warning";
  testId?: string;
}) {
  if (total <= 0) return null;
  const pct = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  const t = tone ?? (done >= total ? "success" : undefined);
  return (
    <div className={cx("progress", t && `tone-${t}`)} data-testid={testId}>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="progress-label">{label ?? `${done}/${total}`}</span>
    </div>
  );
}

export function Stat({
  value,
  label,
  tone,
  href,
  testId,
}: {
  value: ReactNode;
  label: ReactNode;
  tone?: Tone;
  href?: string;
  testId?: string;
}) {
  const body = (
    <>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </>
  );
  const cls = cx("stat", tone && `tone-${tone}`);
  return href ? (
    <Link href={href} className={cls} data-testid={testId}>
      {body}
    </Link>
  ) : (
    <div className={cls} data-testid={testId}>
      {body}
    </div>
  );
}

export type TabItem = {
  href: string;
  label: ReactNode;
  count?: number;
  countTone?: "warning";
  testId?: string;
};

/** Link tabs. The caller says which is current, so this stays a server component. */
export function Tabs({
  items,
  current,
  label,
}: {
  items: TabItem[];
  current: string;
  label: string;
}) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="tab"
          aria-current={t.href === current ? "page" : undefined}
          data-testid={t.testId}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className={cx("tab-count", t.countTone && `tone-${t.countTone}`)}>
              {t.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
