"use client";

import { useState, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

// Numbers 1–14 available, two rows of 5.
// Numbers {2,3,7,8,9,10,11,12,13,14} from the image have no integer solution.
// Using {2,3,4,5,6,7,8,10,12,14} which has 4 solutions:
//   (2,4,6)  (4,6,10)  (5,7,12)  (6,8,14)
const ROW1 = [2, 3, 4, 5, 6];
const ROW2 = [7, 8, 10, 12, 14];
const ALL_NUMBERS = [...ROW1, ...ROW2];

type Slot = "lower" | "upper" | "result";
type Slots = Record<Slot, number | null>;

function isCorrect(slots: Slots): boolean {
  const { lower: a, upper: b, result: c } = slots;
  if (a === null || b === null || c === null) return false;
  return b * b - a * a === 2 * c;
}

function Tex({ src, display = false }: { src: string; display?: boolean }) {
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(src, {
          displayMode: display,
          throwOnError: false,
        }),
      }}
    />
  );
}

function TokenCircle({
  value,
  used,
  dragging,
  onClick,
  onDragStart,
}: {
  value: number;
  used: boolean;
  dragging: boolean;
  onClick: () => void;
  onDragStart: () => void;
}) {
  return (
    <button
      className={`it-token${used ? " it-token--used" : ""}${dragging ? " it-token--dragging" : ""}`}
      draggable={!used}
      onClick={!used ? onClick : undefined}
      onDragStart={!used ? onDragStart : undefined}
      disabled={used}
      title={used ? "Already placed" : `Place ${value}`}
    >
      {value}
    </button>
  );
}

function SlotCircle({
  value,
  label,
  active,
  correct,
  onDrop,
  onDragOver,
  onClick,
}: {
  value: number | null;
  label: string;
  active: boolean;
  correct: boolean;
  onDrop: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onClick: () => void;
}) {
  return (
    <button
      className={`it-slot${value !== null ? " it-slot--filled" : ""}${active ? " it-slot--active" : ""}${correct ? " it-slot--correct" : ""}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
      aria-label={label}
      title={value !== null ? `${label} = ${value} — click to remove` : `${label} — drag a number here`}
    >
      {value !== null ? value : ""}
    </button>
  );
}

export default function CompleteTheIntegralPage() {
  const [slots, setSlots] = useState<Slots>({ lower: null, upper: null, result: null });
  const [dragNum, setDragNum] = useState<number | null>(null);
  const [activeSlot, setActiveSlot] = useState<Slot>("lower");

  const used = useMemo(
    () => new Set(Object.values(slots).filter((v): v is number => v !== null)),
    [slots],
  );

  const solved = useMemo(() => isCorrect(slots), [slots]);

  const placeInSlot = (slot: Slot, n: number) => {
    setSlots((prev) => {
      const old = prev[slot];
      const next = { ...prev, [slot]: n };
      // If the dragged number was already in another slot, clear it
      if (old !== null && old !== n) {
        // return old to pool automatically (just clear it)
      }
      return next;
    });
    // Auto-advance active slot
    const order: Slot[] = ["lower", "upper", "result"];
    const nextEmpty = order.find((s) => s !== slot && slots[s] === null);
    if (nextEmpty) setActiveSlot(nextEmpty);
  };

  const clickToken = (n: number) => {
    if (used.has(n)) return;
    placeInSlot(activeSlot, n);
  };

  const clearSlot = (slot: Slot) => {
    setSlots((prev) => ({ ...prev, [slot]: null }));
    setActiveSlot(slot);
  };

  const handleDrop = (slot: Slot) => {
    if (dragNum === null) return;
    // If number was in another slot, clear that slot
    const fromSlot = (Object.entries(slots) as [Slot, number | null][]).find(
      ([, v]) => v === dragNum,
    )?.[0];
    setSlots((prev) => {
      const next = { ...prev };
      if (fromSlot) next[fromSlot] = null;
      next[slot] = dragNum;
      return next;
    });
    setDragNum(null);
  };

  const clearAll = () => {
    setSlots({ lower: null, upper: null, result: null });
    setActiveSlot("lower");
    setDragNum(null);
  };

  const filledCount = Object.values(slots).filter((v) => v !== null).length;

  return (
    <article className="bt-page">
      <h1>Complete the Integral</h1>
      <p className="muted" style={{ marginTop: "0.25rem" }}>
        Drag or click <strong>3 numbers</strong> into the integral.
        Multiple solutions exist.
      </p>

      <div className="bt-rules" style={{ marginBottom: "1.5rem" }}>
        <Tex
          src="\displaystyle \int_a^b x\,dx \;=\; \frac{b^2 - a^2}{2} \;=\; c"
          display={false}
        />
        <br />
        <span className="muted" style={{ fontSize: "0.88rem" }}>
          Choose <Tex src="a" /> (lower bound), <Tex src="b" /> (upper bound), and{" "}
          <Tex src="c" /> (result) so the equation holds.
        </span>
      </div>

      {/* ── Interactive formula ── */}
      <div className={`it-formula-wrap${solved ? " it-correct" : ""}`}>
        <div className="it-formula">

          {/* ∫ with upper/lower slots */}
          <div className="it-int-group">
            <SlotCircle
              value={slots.upper}
              label="b (upper bound)"
              active={activeSlot === "upper" && !solved}
              correct={solved}
              onDrop={() => handleDrop("upper")}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => slots.upper !== null ? clearSlot("upper") : setActiveSlot("upper")}
            />
            <span className="it-int-sign">∫</span>
            <div style={{ marginTop: "0.6rem" }}>
            <SlotCircle
              value={slots.lower}
              label="a (lower bound)"
              active={activeSlot === "lower" && !solved}
              correct={solved}
              onDrop={() => handleDrop("lower")}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => slots.lower !== null ? clearSlot("lower") : setActiveSlot("lower")}
            />
            </div>
          </div>

          <span className="it-body">
            <Tex src="x\,dx" />
          </span>

          <span className="it-eq"><Tex src="=" /></span>

          <SlotCircle
            value={slots.result}
            label="c (result)"
            active={activeSlot === "result" && !solved}
            correct={solved}
            onDrop={() => handleDrop("result")}
            onDragOver={(e) => e.preventDefault()}
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
            Not equal — try a different combination.
          </p>
        )}
      </div>

      {!solved && filledCount > 0 && (
        <div style={{ marginTop: "0.5rem" }}>
          <button className="bt-clear-btn" onClick={clearAll}>Clear</button>
        </div>
      )}

      {/* ── Number pool — two rows of 5 ── */}
      {!solved && (
        <div className="it-pool">
          <div className="it-pool-row">
            {ROW1.map((n) => (
              <TokenCircle
                key={n}
                value={n}
                used={used.has(n)}
                dragging={dragNum === n}
                onClick={() => clickToken(n)}
                onDragStart={() => setDragNum(n)}
              />
            ))}
          </div>
          <div className="it-pool-row">
            {ROW2.map((n) => (
              <TokenCircle
                key={n}
                value={n}
                used={used.has(n)}
                dragging={dragNum === n}
                onClick={() => clickToken(n)}
                onDragStart={() => setDragNum(n)}
              />
            ))}
          </div>
        </div>
      )}

      {solved && (
        <button className="btn" style={{ marginTop: "1.5rem" }} onClick={clearAll}>
          Try another solution
        </button>
      )}
    </article>
  );
}
