"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { BoardDTO } from "@/lib/abacus";

/* One poll for three screens — the projector, the team's own page and the
 * jury's grid all watch the same board.
 *
 * Polling rather than a socket: the payload is a few hundred bytes, the site is
 * on serverless where a long-lived connection is the awkward thing, and a room
 * of four teams asking every three seconds is nothing. */
const POLL_MS = 3000;

export function useAbacusBoard(code: string, initial: BoardDTO) {
  const [board, setBoard] = useState<BoardDTO>(initial);
  const [stale, setStale] = useState(false);
  // Keeps the interval from restarting on every render.
  const alive = useRef(true);
  const shownAt = useRef(initial.now);

  /* Every board carries the server's clock, and only a newer one is allowed to
   * replace what is on screen. Without this, a poll that left before a verdict
   * was recorded but arrives after it silently un-does that verdict until the
   * next tick — three seconds of a scoreboard lying on a projector. ISO strings
   * in UTC compare lexicographically, so this is just `<`. */
  const apply = useCallback((next: BoardDTO) => {
    if (next.now < shownAt.current) return;
    shownAt.current = next.now;
    setBoard(next);
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/abacus/sessions/${encodeURIComponent(code)}/board`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setStale(true);
        return;
      }
      const data: BoardDTO = await res.json();
      if (alive.current) {
        apply(data);
        setStale(false);
      }
    } catch {
      setStale(true); // offline, or the laptop's lid was shut — keep the last board
    }
  }, [code, apply]);

  useEffect(() => {
    alive.current = true;
    const t = setInterval(poll, POLL_MS);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [poll]);

  return { board, stale, apply, refresh: poll };
}
