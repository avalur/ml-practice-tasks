"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  debatePollStatus,
  winningTeamIds,
  type DebatePollDTO,
  type LessonDebatesDTO,
} from "@/lib/classes-shared";
import { Badge, Notice } from "@/components/ui";

const POLL_MS = 3000;

function formatVoteTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function LessonDebates({
  classSlug,
  lessonSlug,
  initial,
  isSignedIn,
  isMember,
  isTeacher,
}: {
  classSlug: string;
  lessonSlug: string;
  initial: LessonDebatesDTO;
  isSignedIn: boolean;
  isMember: boolean;
  isTeacher: boolean;
}) {
  const [data, setData] = useState<LessonDebatesDTO>(initial);
  const [stale, setStale] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorByDebate, setErrorByDebate] = useState<Record<string, string>>({});

  const alive = useRef(true);
  const shownAt = useRef(initial.now);

  const apply = useCallback((next: LessonDebatesDTO, force = false) => {
    if (!force && next.now < shownAt.current) return;
    shownAt.current = next.now;
    setData(next);
  }, []);

  const pollNow = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/classes/${encodeURIComponent(classSlug)}/lessons/${encodeURIComponent(lessonSlug)}/debates`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setStale(true);
        return;
      }
      const next: LessonDebatesDTO = await res.json();
      if (alive.current) {
        apply(next);
        setStale(false);
      }
    } catch {
      if (alive.current) setStale(true);
    }
  }, [classSlug, lessonSlug, apply]);

  useEffect(() => {
    alive.current = true;
    const tick = () => {
      if (document.hidden) return;
      void pollNow();
    };
    const timer = setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void pollNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollNow]);

  async function castVote(debateId: string, teamId: string) {
    const key = `vote:${debateId}`;
    setBusyKey(key);
    setErrorByDebate((prev) => ({ ...prev, [debateId]: "" }));
    try {
      const res = await fetch(
        `/api/classes/${encodeURIComponent(classSlug)}/lessons/${encodeURIComponent(lessonSlug)}/debates/${encodeURIComponent(debateId)}/vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorByDebate((prev) => ({
          ...prev,
          [debateId]: typeof body.error === "string" ? body.error : "Could not record vote.",
        }));
        void pollNow();
        return;
      }
      apply(body as LessonDebatesDTO, true);
      setStale(false);
    } catch {
      setErrorByDebate((prev) => ({
        ...prev,
        [debateId]: "Network error — please try again.",
      }));
    } finally {
      setBusyKey(null);
    }
  }

  async function setPollState(debateId: string, action: "open" | "close" | "reset", totalVotes: number) {
    if (
      action === "reset" &&
      totalVotes > 0 &&
      typeof window !== "undefined" &&
      !window.confirm("Reset all votes for this debate and close voting?")
    ) {
      return;
    }
    const key = `state:${debateId}`;
    setBusyKey(key);
    setErrorByDebate((prev) => ({ ...prev, [debateId]: "" }));
    try {
      const res = await fetch(
        `/api/classes/${encodeURIComponent(classSlug)}/lessons/${encodeURIComponent(lessonSlug)}/debates/${encodeURIComponent(debateId)}/state`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorByDebate((prev) => ({
          ...prev,
          [debateId]: typeof body.error === "string" ? body.error : "Could not update poll.",
        }));
        return;
      }
      apply(body as LessonDebatesDTO, true);
      setStale(false);
    } catch {
      setErrorByDebate((prev) => ({
        ...prev,
        [debateId]: "Network error — please try again.",
      }));
    } finally {
      setBusyKey(null);
    }
  }

  if (data.unavailable) {
    return (
      <Notice tone="warning" testId="debates-unavailable-notice">
        Debate voting is currently unavailable on this deployment (database table not migrated yet).
      </Notice>
    );
  }

  const lessonUrl = `/classes/${classSlug}/lessons/${lessonSlug}`;

  return (
    <div className="debate-list" data-testid="lesson-debates">
      {data.polls.map((poll) => (
        <DebateCard
          key={poll.id}
          poll={poll}
          classSlug={classSlug}
          lessonUrl={lessonUrl}
          isSignedIn={isSignedIn}
          isMember={isMember}
          isTeacher={isTeacher}
          stale={stale}
          voteBusy={busyKey === `vote:${poll.id}`}
          stateBusy={busyKey === `state:${poll.id}`}
          error={errorByDebate[poll.id] || ""}
          onVote={(teamId) => castVote(poll.id, teamId)}
          onState={(action) => setPollState(poll.id, action, poll.totalVotes)}
        />
      ))}
    </div>
  );
}

function DebateCard({
  poll,
  classSlug,
  lessonUrl,
  isSignedIn,
  isMember,
  isTeacher,
  stale,
  voteBusy,
  stateBusy,
  error,
  onVote,
  onState,
}: {
  poll: DebatePollDTO;
  classSlug: string;
  lessonUrl: string;
  isSignedIn: boolean;
  isMember: boolean;
  isTeacher: boolean;
  stale: boolean;
  voteBusy: boolean;
  stateBusy: boolean;
  error: string;
  onVote: (teamId: string) => void;
  onState: (action: "open" | "close" | "reset") => void;
}) {
  const status = debatePollStatus(poll);
  const winners = status === "closed" ? winningTeamIds(poll.teams) : [];
  const isTie = winners.length > 1;
  const voters = poll.voters ?? [];

  return (
    <section className="debate-card" data-testid={`debate-poll-${poll.id}`}>
      <header className="debate-card-head">
        <div className="debate-card-title-row">
          <h2>{poll.title}</h2>
          {status === "open" ? (
            <Badge tone="success" testId={`debate-status-${poll.id}`}>
              Live · Voting open
            </Badge>
          ) : status === "closed" ? (
            <Badge tone="neutral" testId={`debate-status-${poll.id}`}>
              Voting closed
            </Badge>
          ) : (
            <Badge tone="warning" testId={`debate-status-${poll.id}`}>
              Not open yet
            </Badge>
          )}
          {stale && <span className="muted debate-stale">offline — showing last update</span>}
        </div>
        <span className="debate-total muted" data-testid={`debate-total-${poll.id}`}>
          {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
        </span>
      </header>

      {poll.motion && (
        <p className="debate-motion">
          <span className="debate-motion-label">Motion:</span> &ldquo;{poll.motion}&rdquo;
        </p>
      )}

      {isTeacher && (
        <div className="debate-teacher-controls" data-testid={`debate-controls-${poll.id}`}>
          {poll.isOpen ? (
            <button
              type="button"
              className="btn danger small"
              disabled={stateBusy}
              onClick={() => onState("close")}
              data-testid={`debate-close-${poll.id}`}
            >
              {stateBusy ? "Updating…" : "Close voting"}
            </button>
          ) : (
            <button
              type="button"
              className="btn primary small"
              disabled={stateBusy}
              onClick={() => onState("open")}
              data-testid={`debate-open-${poll.id}`}
            >
              {stateBusy
                ? "Updating…"
                : status === "closed"
                  ? "Reopen voting"
                  : "Open voting"}
            </button>
          )}
          {(status !== "pending" || poll.totalVotes > 0) && (
            <button
              type="button"
              className="btn subtle small"
              disabled={stateBusy}
              onClick={() => onState("reset")}
              data-testid={`debate-reset-${poll.id}`}
            >
              Reset votes
            </button>
          )}
        </div>
      )}

      <div className="debate-teams">
        {poll.teams.map((team, idx) => {
          const isMine = poll.myVote === team.id;
          const isWinner = winners.includes(team.id);
          return (
            <div
              key={team.id}
              className={`debate-team${isMine ? " is-mine" : ""}${isWinner ? " is-winner" : ""}`}
              data-team-slot={idx % 2}
              data-testid={`debate-team-${poll.id}-${team.id}`}
            >
              <div className="debate-team-head">
                <h3 className="debate-team-name">{team.name}</h3>
                <div className="debate-team-badges">
                  {isWinner && (
                    <Badge tone={isTie ? "info" : "success"}>
                      {isTie ? "Tie" : "Winner"}
                    </Badge>
                  )}
                  {isMine && <Badge tone="info">Your vote</Badge>}
                </div>
              </div>

              {team.members.length > 0 && (
                <ol className="debate-members">
                  {team.members.map((member) => (
                    <li key={member}>{member}</li>
                  ))}
                </ol>
              )}

              <div className="debate-tally">
                <div className="debate-tally-row">
                  <span
                    className="debate-votes"
                    data-testid={`debate-votes-${poll.id}-${team.id}`}
                  >
                    <strong>{team.votes}</strong> {team.votes === 1 ? "vote" : "votes"}
                  </span>
                  <span
                    className="debate-pct"
                    data-testid={`debate-pct-${poll.id}-${team.id}`}
                  >
                    {team.percent}%
                  </span>
                </div>
                <div className="debate-bar" aria-hidden="true">
                  <div
                    className="debate-bar-fill"
                    style={{ width: `${team.percent}%` }}
                  />
                </div>
              </div>

              {isMember && (
                <div className="debate-team-action">
                  <button
                    type="button"
                    className={`btn ${isMine ? "subtle is-selected" : "primary"} debate-vote-btn`}
                    disabled={!poll.isOpen || isMine || voteBusy}
                    onClick={() => onVote(team.id)}
                    data-testid={`debate-vote-${poll.id}-${team.id}`}
                  >
                    {isMine
                      ? "✓ Voted"
                      : poll.myVote
                        ? "Switch vote"
                        : "Vote for this team"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="form-error debate-error" role="alert">
          {error}
        </p>
      )}

      {!isSignedIn ? (
        <p className="muted debate-hint">
          <Link href={`/signin?next=${encodeURIComponent(lessonUrl)}`}>Sign in</Link> and enter
          your group code on the <Link href={`/classes/${classSlug}`}>class page</Link> to vote.
        </p>
      ) : !isMember ? (
        <p className="muted debate-hint">
          Join this class with your teacher&rsquo;s group code on the{" "}
          <Link href={`/classes/${classSlug}`}>class page</Link> to vote.
        </p>
      ) : status === "pending" && !isTeacher ? (
        <p className="muted debate-hint">
          Voting will open when the teacher starts the poll. Results update live.
        </p>
      ) : poll.isOpen && poll.myVote ? (
        <p className="muted debate-hint">
          Your vote is recorded. You can switch teams while voting is open.
        </p>
      ) : null}

      {isTeacher && (
        <details className="debate-voters" data-testid={`debate-voters-${poll.id}`}>
          <summary>
            Voter breakdown ({voters.length}) — visible to teachers only
          </summary>
          {voters.length === 0 ? (
            <p className="muted debate-voters-empty">No votes cast yet.</p>
          ) : (
            <div className="debate-voters-grid">
              {poll.teams.map((team) => {
                const teamVoters = voters.filter((v) => v.teamId === team.id);
                return (
                  <div key={team.id} className="debate-voters-col">
                    <h4>
                      {team.name} ({teamVoters.length})
                    </h4>
                    {teamVoters.length === 0 ? (
                      <p className="muted">No votes yet.</p>
                    ) : (
                      <ul>
                        {teamVoters.map((v) => (
                          <li key={v.userId}>
                            <span>{v.name}</span>
                            <span className="muted debate-voter-time">
                              {formatVoteTime(v.votedAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </details>
      )}
    </section>
  );
}
