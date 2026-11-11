"use client";

// The "Compare" tab of the solve workspace: the student's code next to the
// reference, with the differences highlighted. Loaded through next/dynamic, so
// @codemirror/merge only reaches the browser when somebody opens the tab.
//
// Two layouts, picked by the width of the pane (not the window — in fullscreen
// the editor is only ~3/5 of the screen):
//   split    MergeView, "You" on the left, "Reference" on the right;
//   unified  one editor holding your code, the reference's lines shown as
//            read-only chunks between them (phones, narrow panes).
// Colours are by role in both: your lines are --diff-del, the reference's are
// --diff-add — read it as "to get from yours to the reference, take out the
// red, put in the green". The engine's own colours are by side (a/b), and the
// unified editor is side "b", so the classes below re-tag each editor by role.

import { useEffect, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { python } from "@codemirror/lang-python";
import { MergeView, getChunks, unifiedMergeView } from "@codemirror/merge";
import { getDefaultExtensions } from "@uiw/react-codemirror";
import { editorPadding, preserveIndentOnEnter } from "@/lib/editor-extensions";

/** Below this pane width two columns of Python stop being readable. */
const SPLIT_MIN_WIDTH = 720;

const COLLAPSE = { margin: 2, minSize: 4 };

type Mode = "split" | "unified";

export default function CompareView({
  code,
  reference,
  theme,
  onChange,
}: {
  code: string;
  reference: string;
  theme: "light" | "dark";
  onChange: (code: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [chunks, setChunks] = useState<number | null>(null);

  // The editor owns the text while it is open; these refs let a rebuild (theme
  // or layout change) start from the latest edit without re-running on each one.
  const codeRef = useRef(code);
  codeRef.current = code;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Pick the layout from the pane's width, and follow it on resize.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const pick = (w: number) => setMode(w >= SPLIT_MIN_WIDTH ? "split" : "unified");
    pick(host.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => pick(entries[0].contentRect.width));
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !mode) return;

    const base = (readOnly: boolean): Extension[] => [
      // Ahead of basicSetup's own Enter binding, as in the main editor.
      readOnly ? [] : preserveIndentOnEnter,
      getDefaultExtensions({ theme, readOnly, editable: !readOnly }),
      python(),
      editorPadding,
    ];
    const role = (r: "mine" | "ref") => EditorView.editorAttributes.of({ class: `mlp-diff-${r}` });

    if (mode === "split") {
      let view: MergeView | null = null;
      let frame = 0;
      view = new MergeView({
        a: {
          doc: codeRef.current,
          extensions: [
            base(false),
            role("mine"),
            EditorView.updateListener.of((u) => {
              if (!u.docChanged) return;
              onChangeRef.current(u.state.doc.toString());
              // MergeView rediffs inside its own dispatch, after the listeners
              // have run, so read the new chunks on the next frame.
              cancelAnimationFrame(frame);
              frame = requestAnimationFrame(() => view && setChunks(view.chunks.length));
            }),
          ],
        },
        b: { doc: reference, extensions: [base(true), role("ref")] },
        parent: host,
        collapseUnchanged: COLLAPSE,
      });
      setChunks(view.chunks.length);
      const unsync = syncHorizontalScroll(view.a.scrollDOM, view.b.scrollDOM);
      return () => {
        unsync();
        cancelAnimationFrame(frame);
        view?.destroy();
        view = null;
      };
    }

    const count = (s: EditorState) => getChunks(s)?.chunks.length ?? 0;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: codeRef.current,
        extensions: [
          base(false),
          role("mine"),
          unifiedMergeView({
            original: reference,
            mergeControls: false,
            collapseUnchanged: COLLAPSE,
          }),
          EditorView.updateListener.of((u) => {
            if (!u.docChanged) return;
            onChangeRef.current(u.state.doc.toString());
            setChunks(count(u.state));
          }),
        ],
      }),
    });
    setChunks(count(view.state));
    return () => view.destroy();
  }, [mode, theme, reference]);

  return (
    <div className="compare" data-mode={mode ?? undefined}>
      <div className="compare-legend">
        <span className="compare-side">
          <span className="compare-key mine">You</span>
        </span>
        <span className="compare-side">
          <span className="compare-key ref">Reference</span>
          {chunks !== null && (
            <span className="compare-count muted">
              {chunks === 0
                ? "identical"
                : `${chunks} ${chunks === 1 ? "difference" : "differences"}`}
            </span>
          )}
        </span>
      </div>
      <div ref={hostRef} className="compare-cm" data-mode={mode ?? undefined} />
    </div>
  );
}

/**
 * Scroll the two sides of a split view sideways together. MergeView shares the
 * vertical scroll (the whole view is one scroller) but each editor keeps its
 * own horizontal one, so a long line on one side would otherwise slide out of
 * line with its counterpart.
 *
 * Mirroring a scroll fires a scroll event on the other side; `echo` remembers
 * the position we wrote so that event is not mirrored back. That matters when
 * one side is narrower: it clamps (we write 500, it lands on 300), and treating
 * the echo as a user scroll would drag the wider side back to 300.
 */
function syncHorizontalScroll(a: HTMLElement, b: HTMLElement): () => void {
  const echo = new Map<HTMLElement, number>();
  const follow = (src: HTMLElement, dst: HTMLElement) => () => {
    const expected = echo.get(src);
    echo.delete(src);
    if (expected === src.scrollLeft) return;
    const before = dst.scrollLeft;
    dst.scrollLeft = src.scrollLeft;
    // No movement means no scroll event, so nothing to swallow.
    if (dst.scrollLeft !== before) echo.set(dst, dst.scrollLeft);
  };
  const onA = follow(a, b);
  const onB = follow(b, a);
  a.addEventListener("scroll", onA, { passive: true });
  b.addEventListener("scroll", onB, { passive: true });
  return () => {
    a.removeEventListener("scroll", onA);
    b.removeEventListener("scroll", onB);
  };
}
