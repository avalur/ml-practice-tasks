"use client";

/** Opens a route in a small always-there window.
 *
 * The point of the monitor is to sit in a corner of the Mac screen while the
 * projector shows the deck, so it needs its own narrow window rather than a tab.
 */
export function PopOutButton({ url }: { url: string }) {
  return (
    <button
      className="bt-clear-btn"
      onClick={() => window.open(url, "mlp-monitor", "width=460,height=820")}
      title="Open in a small separate window"
    >
      ⧉ Pop out
    </button>
  );
}
