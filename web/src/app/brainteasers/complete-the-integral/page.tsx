"use client";

import { useState, useMemo } from "react";

// Numbers 1–14 available. Solutions: ∫ₐᵇ x dx = (b²−a²)/2 = c
// Valid: (2,4,6) (3,5,8) (4,6,10) (5,7,12) (6,8,14) (1,3,4) (1,5,12) etc.
const ALL_NUMBERS = Array.from({ length: 14 }, (_, i) => i + 1);

type Slot = "lower" | "upper" | "result";

function check(lower: number | null, upper: number | null, result: number | null): boolean {
  if (lower === null || upper === null || result === null) return false;
  // ∫ₐᵇ x dx = (b²−a²)/2
  return (upper * upper - lower * lower) / 2 === result;
}

function SlotCircle({
  value,
  label,
  onClick,
  correct,
}: {
  value: number | null;
  label: string;
  onClick: () => void;
  correct: boolean;
}) {
  return (
    <button
      className={`integral-slot${value !== null ? " filled" : ""}${correct ? " correct" : ""}`}
      onClick={onClick}
      title={value !== null ? `Click to return ${value} to pool` : `${label} — click a number to place here`}
      aria-label={label}
    >
      {value !== null ? value : ""}
    </button>
  );
}

export default function CompleteTheIntegralPage() {
  const [slots, setSlots] = useState<Record<Slot, number | null>>({
    lower: null,
    upper: null,
    result: null,
  });
  const [activeSlot, setActiveSlot] = useState<Slot>("lower");

  const used = useMemo(
    () => new Set(Object.values(slots).filter((v): v is number => v !== null)),
    [slots],
  );

  const solved = useMemo(
    () => check(slots.lower, slots.upper, slots.result),
    [slots],
  );

  const placeNumber = (n: number) => {
    if (used.has(n)) return;
    setSlots((prev) => ({ ...prev, [activeSlot]: n }));
    // Auto-advance to next empty slot
    const order: Slot[] = ["lower", "upper", "result"];
    const nextEmpty = order.find(
      (s) => s !== activeSlot && slots[s] === null && s !== activeSlot,
    );
    // Find first empty slot after placing
    setActiveSlot((prev) => {
      const next = order.find((s) => {
        const updated = { ...slots, [prev]: n };
        return updated[s] === null && s !== prev;
      });
      return next ?? prev;
    });
  };

  const clearSlot = (slot: Slot) => {
    setSlots((prev) => ({ ...prev, [slot]: null }));
    setActiveSlot(slot);
  };

  const clearAll = () => {
    setSlots({ lower: null, upper: null, result: null });
    setActiveSlot("lower");
  };

  const slotOrder: Slot[] = ["lower", "upper", "result"];
  const filledCount = slotOrder.filter((s) => slots[s] !== null).length;

  return (
    <article className="bt-page">
      <h1>Complete the Integral</h1>
      <p className="muted" style={{ marginTop: "0.25rem" }}>
        Place <strong>3 numbers</strong> into the integral so the equation holds.
        Multiple solutions exist.
      </p>

      <div className="bt-rules">
        <strong>Formula:</strong> &nbsp;
        ∫<sub>a</sub><sup>b</sup> x dx &nbsp;=&nbsp;
        <sup>b² − a²</sup>⁄<sub>2</sub>
        &nbsp;= c
        <br />
        <strong>Rules:</strong> Choose a (lower bound), b (upper bound), and c (result).
        All three must be different numbers from the pool.
      </div>

      {/* ── Integral display ── */}
      <div className={`integral-display${solved ? " correct" : ""}`}>
        <div className="integral-expr">

          {/* Integral sign with bounds */}
          <div className="integral-sign-wrap">
            <SlotCircle
              value={slots.upper}
              label="upper bound b"
              onClick={() => slots.upper !== null ? clearSlot("upper") : setActiveSlot("upper")}
              correct={solved}
            />
            <span className="integral-sym">∫</span>
            <SlotCircle
              value={slots.lower}
              label="lower bound a"
              onClick={() => slots.lower !== null ? clearSlot("lower") : setActiveSlot("lower")}
              correct={solved}
            />
          </div>

          {/* x dx */}
          <span className="integral-body">x dx</span>

          {/* = */}
          <span className="integral-eq">=</span>

          {/* Result */}
          <SlotCircle
            value={slots.result}
            label="result c"
            onClick={() => slots.result !== null ? clearSlot("result") : setActiveSlot("result")}
            correct={solved}
          />
        </div>

        {solved && (
          <div className="integral-success">
            🎉 Correct! &nbsp;
            ∫<sub>{slots.lower}</sub><sup>{slots.upper}</sup> x dx = ({slots.upper}² − {slots.lower}²) / 2 = {slots.result}
          </div>
        )}

        {!solved && filledCount > 0 && (
          <div className="integral-hint muted">
            Active slot: <strong>{activeSlot === "lower" ? "a (lower)" : activeSlot === "upper" ? "b (upper)" : "c (result)"}</strong>
            {filledCount === 3 && " — not equal, try a different combination"}
          </div>
        )}
      </div>

      {/* Active slot selector */}
      {!solved && (
        <div className="integral-slot-select">
          {(["lower", "upper", "result"] as Slot[]).map((s) => (
            <button
              key={s}
              className={`integral-slot-btn${activeSlot === s ? " active" : ""}${slots[s] !== null ? " has-value" : ""}`}
              onClick={() => { if (slots[s] !== null) clearSlot(s); else setActiveSlot(s); }}
            >
              {s === "lower" ? "a (lower)" : s === "upper" ? "b (upper)" : "c (result)"}
              {slots[s] !== null && <span> = {slots[s]} ✕</span>}
            </button>
          ))}
          {filledCount > 0 && (
            <button className="bt-clear-btn" onClick={clearAll}>Clear all</button>
          )}
        </div>
      )}

      {/* Number pool */}
      {!solved && (
        <div className="bt-pool" style={{ marginTop: "1.5rem" }}>
          {ALL_NUMBERS.map((n) => (
            <button
              key={n}
              className={`bt-tile bt-digit${used.has(n) ? " used" : ""}`}
              onClick={() => placeNumber(n)}
              disabled={used.has(n)}
              title={used.has(n) ? "Already placed" : `Place ${n}`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {solved && (
        <div style={{ marginTop: "1.5rem" }}>
          <button className="btn" onClick={clearAll}>Try another solution</button>
        </div>
      )}
    </article>
  );
}
