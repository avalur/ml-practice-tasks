"use client";

import { useState, useMemo, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

// Two rows of 5. The image numbers {2,3,7,8,9,10,11,12,13,14} have no integer
// solution for ∫ₐᵇ x dx = (b²−a²)/2 = c, so we use {2,3,4,5,6,7,8,10,12,14}
// which has four solutions: (2,4,6) (4,6,10) (5,7,12) (6,8,14).
const ROW1 = [2, 3, 4, 5, 6];
const ROW2 = [7, 8, 10, 12, 14];

type Slot = "lower" | "upper" | "result";
type Slots = Record<Slot, number | null>;

function isCorrect(s: Slots): boolean {
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

type DragState = { n: number; x: number; y: number; moved: boolean };

export default function CompleteTheIntegralPage() {
  const [slots, setSlots] = useState<Slots>({ lower: null, upper: null, result: null });
  const [activeSlot, setActiveSlot] = useState<Slot>("lower");
  const [drag, setDrag] = useState<DragState | null>(null);

  // Ref mirrors `drag` so pointer handlers read the current value synchronously.
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const used = useMemo(
    () => new Set(Object.values(slots).filter((v): v is number => v !== null)),
    [slots],
  );
  const solved = useMemo(() => isCorrect(slots), [slots]);
  const filled = Object.values(slots).filter((v) => v !== null).length;

  function place(slot: Slot, n: number) {
    setSlots((prev) => {
      const next = { ...prev };
      // remove n from any slot it's already in (allows moving between slots)
      for (const s of Object.keys(next) as Slot[]) {
        if (next[s] === n) next[s] = null;
      }
      next[slot] = n;
      return next;
    });
    const order: Slot[] = ["lower", "upper", "result"];
    const nextEmpty = order.find((s) => s !== slot && slots[s] === null);
    if (nextEmpty) setActiveSlot(nextEmpty);
  }

  function clearSlot(slot: Slot) {
    setSlots((prev) => ({ ...prev, [slot]: null }));
    setActiveSlot(slot);
  }

  function clearAll() {
    setSlots({ lower: null, upper: null, result: null });
    setActiveSlot("lower");
    setDrag(null);
  }

  // ── Pointer-based drag (reliable across all browsers, unlike HTML5 DnD) ──
  function onTokenPointerDown(n: number, e: React.PointerEvent<HTMLButtonElement>) {
    if (used.has(n)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ n, x: e.clientX, y: e.clientY, moved: false });
  }

  function onTokenPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d) return;
    const moved = d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6;
    setDrag({ ...d, x: e.clientX, y: e.clientY, moved });
  }

  function onTokenPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    setDrag(null);
    if (!d) return;

    if (!d.moved) {
      // A tap (no real movement) → place into the active slot.
      place(activeSlot, d.n);
      return;
    }
    // A drag → find the slot under the release point.
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const slotEl = el?.closest<HTMLElement>("[data-slot]");
    if (slotEl?.dataset.slot) {
      place(slotEl.dataset.slot as Slot, d.n);
    }
    // else: dropped outside any slot → number stays in the pool
  }

  return (
    <article className="bt-page" style={{ userSelect: "none" }}>
      <h1>Complete the Integral</h1>
      <p className="muted" style={{ marginTop: "0.25rem" }}>
        Drag or click <strong>3 numbers</strong> into the integral. Multiple
        solutions exist.
      </p>

      <div className="bt-rules" style={{ marginBottom: "1.5rem" }}>
        <Tex src="\displaystyle \int_a^b x\,dx \;=\; \frac{b^2 - a^2}{2} \;=\; c" />
        <br />
        <span className="muted" style={{ fontSize: "0.88rem" }}>
          Choose <Tex src="a" /> (lower bound), <Tex src="b" /> (upper bound),
          and <Tex src="c" /> (result) so the equation holds.
        </span>
      </div>

      {/* ── Interactive formula ── */}
      <div className={`it-formula-wrap${solved ? " it-correct" : ""}`}>
        <div className="it-formula">
          {/* ∫ with upper/lower slots */}
          <div className="it-int-group">
            <SlotCircle
              slot="upper"
              value={slots.upper}
              active={activeSlot === "upper" && !solved}
              correct={solved}
              dragging={drag?.moved ?? false}
              onClick={() =>
                slots.upper !== null ? clearSlot("upper") : setActiveSlot("upper")
              }
            />
            <span className="it-int-sign">∫</span>
            <div style={{ marginTop: "0.6rem" }}>
              <SlotCircle
                slot="lower"
                value={slots.lower}
                active={activeSlot === "lower" && !solved}
                correct={solved}
                dragging={drag?.moved ?? false}
                onClick={() =>
                  slots.lower !== null ? clearSlot("lower") : setActiveSlot("lower")
                }
              />
            </div>
          </div>

          <span className="it-body">
            <Tex src="x\,dx" />
          </span>

          <span className="it-eq">
            <Tex src="=" />
          </span>

          <SlotCircle
            slot="result"
            value={slots.result}
            active={activeSlot === "result" && !solved}
            correct={solved}
            dragging={drag?.moved ?? false}
            onClick={() =>
              slots.result !== null ? clearSlot("result") : setActiveSlot("result")
            }
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

        {!solved && filled === 3 && (
          <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.88rem" }}>
            Not equal — try a different combination.
          </p>
        )}
      </div>

      {!solved && filled > 0 && (
        <div style={{ marginTop: "0.5rem" }}>
          <button className="bt-clear-btn" onClick={clearAll}>
            Clear
          </button>
        </div>
      )}

      {/* ── Number pool — two rows of 5 ── */}
      {!solved && (
        <div className="it-pool">
          {[ROW1, ROW2].map((row, ri) => (
            <div key={ri} className="it-pool-row">
              {row.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`it-token${used.has(n) ? " it-token--used" : ""}${
                    drag?.n === n && drag.moved ? " it-token--dragging" : ""
                  }`}
                  disabled={used.has(n)}
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => onTokenPointerDown(n, e)}
                  onPointerMove={onTokenPointerMove}
                  onPointerUp={onTokenPointerUp}
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

      {/* Floating ghost that follows the cursor while dragging */}
      {drag?.moved && (
        <div
          className="it-token it-token--ghost"
          style={{
            position: "fixed",
            left: drag.x,
            top: drag.y,
            transform: "translate(-50%, -50%) scale(1.1)",
            pointerEvents: "none",
            zIndex: 9999,
          }}
        >
          {drag.n}
        </div>
      )}
    </article>
  );
}

// ── Slot — data-slot is used by elementFromPoint to detect the drop target ──

function SlotCircle({
  slot,
  value,
  active,
  correct,
  dragging,
  onClick,
}: {
  slot: Slot;
  value: number | null;
  active: boolean;
  correct: boolean;
  dragging: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-slot={slot}
      className={`it-slot${value !== null ? " it-slot--filled" : ""}${
        active ? " it-slot--active" : ""
      }${correct ? " it-slot--correct" : ""}${dragging ? " it-slot--target" : ""}`}
      onClick={onClick}
      title={
        value !== null
          ? `= ${value} — click to remove`
          : "drag a number here, or click then pick a number"
      }
    >
      {value !== null ? value : ""}
    </button>
  );
}
