/* Server-side reads and helpers for in-class debate polls.
 *
 * Poll definitions (title, motion, teams, members) live in class.json so the
 * course stays file-first; Postgres stores only the live open/closed state and
 * member votes. Individual voter names are queried and returned strictly for
 * teachers — never sent over the wire to students or anonymous visitors. */

import { prisma } from "@/lib/db";
import { isMissingTable } from "@/lib/notebook-submissions";
import {
  teamVotePercent,
  type DebatePollDTO,
  type DebateSpec,
  type DebateVoterDTO,
  type Lesson,
  type LessonDebatesDTO,
} from "./classes-shared";

export function findDebateSpec(lesson: Lesson | null, debateId: string): DebateSpec | null {
  return lesson?.debates?.find((d) => d.id === debateId) ?? null;
}

function emptyPoll(spec: DebateSpec): DebatePollDTO {
  return {
    id: spec.id,
    title: spec.title,
    motion: spec.motion ?? null,
    isOpen: false,
    openedAt: null,
    closedAt: null,
    totalVotes: 0,
    teams: spec.teams.map((t) => ({
      id: t.id,
      name: t.name,
      members: t.members ?? [],
      votes: 0,
      percent: 0,
    })),
    myVote: null,
  };
}

export async function readLessonDebates(params: {
  classId: string;
  lessonSlug: string;
  debates: DebateSpec[];
  userId: string | null;
  isTeacher: boolean;
}): Promise<LessonDebatesDTO> {
  const { classId, lessonSlug, debates, userId, isTeacher } = params;
  // Stamped before the query so a slower poll can never claim to be newer than
  // a click that settled right after it (same rule as Abacus readBoard).
  const now = new Date().toISOString();

  if (debates.length === 0) {
    return { now, polls: [] };
  }

  let rows: Array<{
    debateId: string;
    isOpen: boolean;
    openedAt: Date | null;
    closedAt: Date | null;
    votes: Array<{
      userId: string;
      teamId: string;
      updatedAt: Date;
      user?: { name: string | null; email: string | null };
    }>;
  }>;

  try {
    rows = await prisma.debatePoll.findMany({
      where: {
        classId,
        lessonSlug,
        debateId: { in: debates.map((d) => d.id) },
      },
      select: {
        debateId: true,
        isOpen: true,
        openedAt: true,
        closedAt: true,
        votes: {
          orderBy: { updatedAt: "desc" },
          select: isTeacher
            ? {
                userId: true,
                teamId: true,
                updatedAt: true,
                user: { select: { name: true, email: true } },
              }
            : {
                userId: true,
                teamId: true,
                updatedAt: true,
              },
        },
      },
    });
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        now,
        polls: debates.map(emptyPoll),
        unavailable: true,
      };
    }
    throw err;
  }

  const byId = new Map(rows.map((r) => [r.debateId, r]));

  const polls: DebatePollDTO[] = debates.map((spec) => {
    const row = byId.get(spec.id);
    if (!row) {
      const poll = emptyPoll(spec);
      if (isTeacher) poll.voters = [];
      return poll;
    }

    const validTeamIds = new Set(spec.teams.map((t) => t.id));
    const counts = new Map<string, number>();
    let myVote: string | null = null;
    const voters: DebateVoterDTO[] = [];

    for (const v of row.votes) {
      if (!validTeamIds.has(v.teamId)) continue;
      counts.set(v.teamId, (counts.get(v.teamId) ?? 0) + 1);
      if (userId && v.userId === userId) {
        myVote = v.teamId;
      }
      if (isTeacher) {
        const displayName = v.user?.name?.trim() || v.user?.email || "Student";
        voters.push({
          userId: v.userId,
          name: displayName,
          email: v.user?.email ?? null,
          teamId: v.teamId,
          votedAt: v.updatedAt.toISOString(),
        });
      }
    }

    const totalVotes = Array.from(counts.values()).reduce((sum, n) => sum + n, 0);

    const dto: DebatePollDTO = {
      id: spec.id,
      title: spec.title,
      motion: spec.motion ?? null,
      isOpen: row.isOpen,
      openedAt: row.openedAt ? row.openedAt.toISOString() : null,
      closedAt: row.closedAt ? row.closedAt.toISOString() : null,
      totalVotes,
      teams: spec.teams.map((t) => {
        const votes = counts.get(t.id) ?? 0;
        return {
          id: t.id,
          name: t.name,
          members: t.members ?? [],
          votes,
          percent: teamVotePercent(votes, totalVotes),
        };
      }),
      myVote,
    };

    if (isTeacher) {
      dto.voters = voters;
    }

    return dto;
  });

  return { now, polls };
}
