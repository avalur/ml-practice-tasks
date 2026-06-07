"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { id: string; topic: string; slug: string; title: string };

export function ProblemsSidebar({ items }: { items: Item[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);
  // True until the first /api/progress resolves; pulses the bullets meanwhile.
  const [loading, setLoading] = useState(true);
  // Tasks whose passing run is being saved — their bullet pulses until the ✓ lands.
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCollapsed(localStorage.getItem("mlp:sidebar") === "1");
  }, []);

  const refreshProgress = useCallback(() => {
    fetch("/api/progress")
      .then((r) => (r.ok ? r.json() : { solved: [], streak: 0 }))
      .then((d) => {
        setSolved(new Set<string>(d.solved ?? []));
        setStreak(d.streak ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refreshProgress();
  }, [refreshProgress]);

  // Cross-component progress signals from SolveWorkspace:
  //  • mlp:progress-pending — a passing run is being saved → pulse the bullet.
  //  • mlp:progress         — the save settled → stop pulsing, and on a win flip
  //    the badge to ✓ optimistically, then reconcile the count and streak.
  useEffect(() => {
    const clearPending = (id: string) =>
      setPending((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

    const onPending = (e: Event) => {
      const id = (e as CustomEvent<{ problemId?: string }>).detail?.problemId;
      if (id) setPending((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    };
    const onProgress = (e: Event) => {
      const detail = (e as CustomEvent<{ problemId?: string; solved?: boolean }>).detail;
      const id = detail?.problemId;
      if (id) clearPending(id);
      if (!detail?.solved) return;
      if (id) {
        setSolved((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      }
      refreshProgress();
    };

    window.addEventListener("mlp:progress-pending", onPending);
    window.addEventListener("mlp:progress", onProgress);
    return () => {
      window.removeEventListener("mlp:progress-pending", onPending);
      window.removeEventListener("mlp:progress", onProgress);
    };
  }, [refreshProgress]);

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("mlp:sidebar", next ? "1" : "0");
      return next;
    });

  // Group problems into a family → subfolder → files tree (numpy_basics →
  // numpy / basics).
  const tree = useMemo(() => {
    const fam: Record<string, Record<string, Item[]>> = {};
    for (const it of items) {
      const [family, ...rest] = it.topic.split("_");
      const sub = rest.join("_") || family;
      (fam[family] ??= {})[sub] ??= [];
      fam[family][sub].push(it);
    }
    return fam;
  }, [items]);

  if (collapsed) {
    return (
      <aside className="sidebar collapsed">
        <button className="sidebar-toggle" onClick={toggle} title="Show problems" aria-label="Show problems">
          ▸
        </button>
      </aside>
    );
  }

  const total = items.length;
  const solvedCount = items.filter((i) => solved.has(i.id)).length;

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="sidebar-title">Problems</span>
        <button className="sidebar-toggle" onClick={toggle} title="Hide panel" aria-label="Hide panel">
          ◂
        </button>
      </div>

      <div className="sidebar-progress">
        {streak > 0 && <div className="streak">🔥 {streak}-day streak</div>}
        <div className="muted">
          {solvedCount}/{total} solved
        </div>
        <div className="bar">
          <div
            className="bar-fill"
            style={{ width: `${total ? (solvedCount / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <nav className="tree">
        {Object.entries(tree).map(([family, subs]) => (
          <Folder key={family} label={family} defaultOpen>
            {Object.entries(subs).map(([sub, probs]) => {
              const s = probs.filter((p) => solved.has(p.id)).length;
              return (
                <Folder key={sub} label={sub} count={`${s}/${probs.length}`} defaultOpen>
                  {probs.map((p) => {
                    const href = `/problems/${p.topic}/${p.slug}`;
                    const active = pathname === href;
                    return (
                      <Link key={p.id} href={href} className={`file${active ? " active" : ""}`}>
                        <span
                          className={`check${solved.has(p.id) ? " done" : ""}${
                            loading || pending.has(p.id) ? " loading" : ""
                          }`}
                        >
                          {solved.has(p.id) ? "✓" : "•"}
                        </span>
                        <span className="file-title">{p.title}</span>
                      </Link>
                    );
                  })}
                </Folder>
              );
            })}
          </Folder>
        ))}
      </nav>
    </aside>
  );
}

function Folder({
  label,
  count,
  defaultOpen,
  children,
}: {
  label: string;
  count?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="folder">
      <button className="folder-head" onClick={() => setOpen((o) => !o)}>
        <span className="caret">{open ? "▾" : "▸"}</span>
        <span className="folder-label">{label}</span>
        {count && <span className="folder-count">{count}</span>}
      </button>
      {open && <div className="folder-body">{children}</div>}
    </div>
  );
}
