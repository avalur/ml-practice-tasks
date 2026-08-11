"use client";

/** Opens the browser's print dialog — "Save as PDF" there is how the statement
 *  sheet becomes a file. Hidden from the printout itself by `.no-print`. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn no-print" onClick={() => window.print()}>
      🖨 {label}
    </button>
  );
}
