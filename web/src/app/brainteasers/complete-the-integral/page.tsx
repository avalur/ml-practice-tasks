"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

const ROW1 = [2, 3, 4, 5, 6];
const ROW2 = [7, 8, 10, 12, 14];
// Solutions: (2,4,6) (4,6,10) (5,7,12) (6,8,14)

type Slot = "lower" | "upper" | "result";
type Slots = Record<Slot, number | null>;

function isCorrect(s: Slots) {
  const { lower: a, upper: b, result: c } = s;
  if (a === null || b === null || c === null) return false;
  return b * b - a * a === 2 * c;
}

function Tex({ src }: { src: string }) {
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(src, { throwOnError: false }),
      }}
    />
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function CompleteTheIntegralPage() {
  const [slots, setSlots] = useState<Slots>({ lower: null, upper: null, result: null });
  const [activeSlot, setActiveSlot] = useState<Slot>("lower");

  // Pointer-drag state — a ref keeps it synchronous for pointermove/pointerup
  const dragRef = useRef<{ n: number; startX: number; startY: number } | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [dragN, setDragN] = useState<number | null>(null);

  const used = useMemo(
    () => new Set(Object.values(slots).filter((v): v is number => v !== null)),
    [slots],
  );
  const solved = useMemo(() => isCorrect(slots), [slots]);

  const placeInSlot = useCallback((slot: Slot, n: number) => {
    setSlots((prev) => {
      const next = { ...prev };
      // Remove this number from any other slot it might be in
      for (const s of Object.keys(next) as Slot[]) {
        if (next[s] === n) next[s] = null;
      }
      next[slot] = n;
      return next;
    });
    setActiveSlot(slot);
  }, []);

  const clearSlot = useCallback((slot: Slot) => {
    setSlots((prev) => ({ ...prev, [slot]: null }));
    setActiveSlot(slot);
  }, []);

  // Click-to-place (fallback / alternative to drag)
  const clickToken = (n: number) => {
    if (used.has(n)) return;
    placeInSlot(activeSlot, n);
  };

  // Pointer-based drag handlers
  const onPointerDown = (n: number, e: React.PointerEvent<HTMLButtonElement>) => {
    if (used.has(n)) return;
    e.preventDefault();
    dragRef.current = { n, startX: e.clientX, startY: e.clientY };
    setGhostPos({ x: e.clientX, y: e.clientY });
    setDragN(n);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    setGhostPos({ x: e.clientX, y: e.clientY });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    setGhostPos(null);
    setDragN(null);
    if (!d) return;

    // Find which slot is under the pointer
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const slotEl = target?.closest("[data-slot]") as HTMLElement | null;
    if (slotEl?.dataset.slot) {
      placeInSlot(slotEl.dataset.slot as Slot, d.n);
    } else {
      // Tiny movement = treat as click → place in active slot
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        clickToken(d.n);
      }
    }
  };

  const clearAll = () => {
    setSlots({ lower: null, upper: null, result: null });
    setActiveSlot("lower");
  };

  const filledCount = Object.values(slots).filter((v) => v !== null).length;

  // Ghost circle that follows the cursor while dragging
  const GHOST_R = 30;

  return (
    <article className="bt-page" style={{ userSelect: "none" }}>
      <h1>Complete the Integral</h1>
      <p className="muted" style={{ marginTop: "0.25rem" }}>
        Drag (or click) <strong>3 numbers</strong> into the integral.
        Multiple solutions exist.
      </p>

      <div className="bt-rules" style={{ marginBottom: "1.5rem" }}>
        <Tex src="\displaystyle \int_a^b x\,dx \;=\; \frac{b^2 - a^2}{2} \;=\; c" />
        <br />
        <span className="muted" style={{ fontSize: "0.88rem" }}>
          Choose <Tex src="a" /> (lower), <Tex src="b" /> (upper), <Tex src="c" /> (result).
        </span>
      </div>

      {/* ── Interactive formula ── */}
      <div className={`it-formula-wrap${solved ? " it-correct" : ""}`}>
        <div className="it-formula">

          {/* ∫ with upper/lower slots */}
          <div className="it-int-group">
            <SlotBtn
              value={slots.upper}
              slot="upper"
              active={activeSlot === "upper" && !solved}
              correct={solved}
              onClick={() => slots.upper !== null ? clearSlot("upper") : setActiveSlot("upper")}
            />
            <span className="it-int-sign">∫</span>
            <div style={{ marginTop: "0.6rem" }}>
              <SlotBtn
                value={slots.lower}
                slot="lower"
                active={activeSlot === "lower" && !solved}
                correct={solved}
                onClick={() => slots.lower !== null ? clearSlot("lower") : setActiveSlot("lower")}
              />
            </div>
          </div>

          <span className="it-body"><Tex src="x\,dx" /></span>
          <span className="it-eq"><Tex src="=" /></span>

          <SlotBtn
            value={slots.result}
            slot="result"
            active={activeSlot === "result" && !solved}
            correct={solved}
            onClick={() => slots.result !== null ? clearSlot("result") : setActiveSlot("result")}
          />
        </div>

        {solved && (
          <div className="it-success">
            🎉&nbsp;
            <Tex
              src={`\\int_{${slots.lower}}^{${slots.upper}} x\\,dx = \\frac{${slots.upper}^2 - ${slots.lower}^2}{2} = ${slots.result}`}
            />
          </div>
        )}
        {!solved && filledCount === 3 && (
          <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.88rem" }}>
            Not equal yet — try a different combination.
          </p>
        )}
      </div>

      {!solved && filledCount > 0 && (
        <div style={{ marginTop: "0.5rem" }}>
          <button className="bt-clear-btn" onClick={clearAll}>Clear</button>
        </div>
      )}

      {/* ── Number pool — two rows ── */}
      {!solved && (
        <div className="it-pool">
          {[ROW1, ROW2].map((row, ri) => (
            <div key={ri} className="it-pool-row">
              {row.map((n) => (
                <button
                  key={n}
                  className={`it-token${used.has(n) ? " it-token--used" : ""}${dragN === n ? " it-token--dragging" : ""}`}
                  disabled={used.has(n)}
                  onPointerDown={(e) => onPointerDown(n, e)}
                  onPointerMove={(e) => onPointerMove(e)}
                  onPointerUp={(e) => onPointerUp(e)}
                  style={{ touchAction: "none" }}
                >
                  {n}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {solved && (
        <button className="btn" style={{ marginTop: "1.5rem" }} onClick={clearAll}>
          Try another solution
        </button>
      )}

      {/* Floating ghost while dragging */}
      {ghostPos && dragN !== null && (
        <div
          className="it-token it-ghost"
          style={{
            position: "fixed",
            left: ghostPos.x - GHOST_R,
            top: ghostPos.y - GHOST_R,
            width: GHOST_R * 2,
            height: GHOST_R * 2,
            pointerEvents: "none",
            zIndex: 9999,
            transform: "scale(1.12)",
            opacity: 0.85,
          }}
        >
          {dragN}
        </div>
      )}
    </article>
  );
}

// ── Slot button — data-slot attribute used by elementFromPoint ─────────────

function SlotBtn({
  value,
  slot,
  active,
  correct,
  onClick,
}: {
  value: number | null;
  slot: Slot;
  active: boolean;
  correct: boolean;
  onClick: () => void;
}) {
  return (
    <button
      data-slot={slot}
      className={`it-slot${value !== null ? " it-slot--filled" : ""}${active ? " it-slot--active" : ""}${correct ? " it-slot--correct" : ""}`}
      onClick={onClick}
      title={value !== null ? `= ${value} — click to remove` : "drop a number here"}
    >
      {value !== null ? value : ""}
    </button>
  );
}
