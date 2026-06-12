"use client";

import { useState, useMemo, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type TileKind = "digit" | "op" | "eq" | "paren";

interface Tile {
  id: string;
  value: string;
  kind: TileKind;
  free?: boolean; // parentheses are unlimited
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTiles(digits: number[]): Tile[] {
  return [
    ...digits.map((d, i) => ({ id: `d${i}`, value: String(d), kind: "digit" as TileKind })),
    { id: "plus",  value: "+", kind: "op" as TileKind },
    { id: "times", value: "×", kind: "op" as TileKind },
    { id: "eq",    value: "=", kind: "eq" as TileKind },
  ];
}

/** Build a math expression string from tiles, merging adjacent digit tiles. */
function buildExpr(tiles: Tile[]): string {
  let out = "";
  let num = "";
  for (const t of tiles) {
    if (t.kind === "digit") {
      num += t.value;
    } else {
      if (num) { out += num; num = ""; }
      out += t.value;
    }
  }
  return out + num;
}

/** Safely evaluate a math expression using only +, *, (, ), digits. */
function safeEval(expr: string): number | null {
  if (!expr.trim()) return null;
  const js = expr.replace(/×/g, "*");
  if (!/^[0-9+*()\s]+$/.test(js)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const v = Function('"use strict"; return (' + js + ")")();
    return typeof v === "number" && isFinite(v) && v >= 0 ? v : null;
  } catch {
    return null;
  }
}

type Status = "idle" | "incomplete" | "invalid" | "correct";

function getStatus(placed: Tile[], required: Tile[]): Status {
  const requiredIds = required.map((t) => t.id);
  const placedIds = new Set(placed.map((t) => t.id));
  const allUsed = requiredIds.every((id) => placedIds.has(id));
  if (!allUsed) return "incomplete";

  const eqIdx = placed.findIndex((t) => t.kind === "eq");
  if (eqIdx < 0) return "invalid";

  const lhs = buildExpr(placed.slice(0, eqIdx));
  const rhs = buildExpr(placed.slice(eqIdx + 1));
  const lv = safeEval(lhs);
  const rv = safeEval(rhs);
  if (lv === null || rv === null) return "invalid";
  return lv === rv ? "correct" : "invalid";
}

// ─── Puzzle component ────────────────────────────────────────────────────────

function Puzzle({ digits, num }: { digits: number[]; num: number }) {
  const tiles = useMemo(() => makeTiles(digits), [digits]);
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const usedIds = useMemo(() => new Set(placed.map((t) => t.id)), [placed]);
  const status = useMemo(() => getStatus(placed, tiles), [placed, tiles]);

  const addTile = useCallback(
    (tile: Tile) => {
      if (!tile.free && usedIds.has(tile.id)) return;
      // For free parens, clone with unique id
      const placed_tile: Tile = tile.free
        ? { ...tile, id: `${tile.id}_${Date.now()}` }
        : tile;
      setPlaced((p) => [...p, placed_tile]);
    },
    [usedIds]
  );

  const removeTile = useCallback((i: number) => {
    setPlaced((p) => p.filter((_, idx) => idx !== i));
  }, []);

  const clear = () => setPlaced([]);

  // Drag-and-drop reordering within the equation
  const onDragStart = (i: number) => setDragIdx(i);
  const onDrop = (i: number) => {
    if (dragIdx === null || dragIdx === i) return;
    setPlaced((p) => {
      const next = [...p];
      const [item] = next.splice(dragIdx, 1);
      next.splice(i, 0, item);
      return next;
    });
    setDragIdx(null);
  };

  const PARENS: Tile[] = [
    { id: "lp", value: "(", kind: "paren", free: true },
    { id: "rp", value: ")", kind: "paren", free: true },
  ];

  return (
    <div className={`bt-puzzle${status === "correct" ? " correct" : ""}`}>
      <div className="bt-puzzle-header">
        <span className="bt-puzzle-num">Puzzle {num}</span>
        {status === "correct" && (
          <span className="bt-status-ok">🎉 Correct!</span>
        )}
        {placed.length > 0 && (
          <button className="bt-clear-btn" onClick={clear}>
            Clear
          </button>
        )}
      </div>

      {/* Equation builder */}
      <div
        className="bt-equation"
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => onDrop(placed.length)}
      >
        {placed.length === 0 ? (
          <span className="bt-placeholder">Click tiles below to build the equation…</span>
        ) : (
          placed.map((t, i) => (
            <div
              key={t.id}
              className={`bt-tile bt-${t.kind} placed`}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => { e.stopPropagation(); onDrop(i); }}
              onClick={() => removeTile(i)}
              title="Click to remove"
            >
              {t.value}
            </div>
          ))
        )}
      </div>

      {/* Tile pool */}
      <div className="bt-pool">
        <div className="bt-pool-section">
          {tiles.map((t) => (
            <button
              key={t.id}
              className={`bt-tile bt-${t.kind}${usedIds.has(t.id) ? " used" : ""}`}
              onClick={() => addTile(t)}
              disabled={usedIds.has(t.id)}
              title={usedIds.has(t.id) ? "Already placed" : "Click to add"}
            >
              {t.value}
            </button>
          ))}
        </div>
        <div className="bt-pool-sep" />
        <div className="bt-pool-section">
          {PARENS.map((t) => (
            <button
              key={t.id}
              className="bt-tile bt-paren"
              onClick={() => addTile(t)}
              title="Optional — click to add"
            >
              {t.value}
            </button>
          ))}
          <span className="bt-paren-hint">optional</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const PUZZLES = [
  { num: 1, digits: [1, 2, 3, 4, 5] },
  { num: 2, digits: [1, 2, 3, 4, 6] },
  { num: 3, digits: [1, 2, 3, 4, 9] },
];

export default function AlzheimerMathPage() {
  return (
    <article className="bt-page">
      <h1>Alzheimer&apos;s Prevention: Math Edition</h1>
      <p className="muted" style={{ marginTop: "0.25rem" }}>
        Arrange the digits and signs to form a <strong>valid equation</strong>.
      </p>

      <div className="bt-rules">
        <strong>Rules:</strong>
        <ul>
          <li>Use each digit and operator card <strong>exactly once</strong>.</li>
          <li>Adjacent digit cards combine into multi-digit numbers (e.g. <code>1</code> <code>3</code> → <code>13</code>).</li>
          <li>Parentheses <code>( )</code> are optional extras — use as many as you like.</li>
          <li>Click a tile to add it; click a placed tile to remove it. Drag to reorder.</li>
        </ul>
      </div>

      {PUZZLES.map((p) => (
        <Puzzle key={p.num} num={p.num} digits={p.digits} />
      ))}
    </article>
  );
}
