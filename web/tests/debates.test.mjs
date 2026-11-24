import assert from "node:assert/strict";
import { test } from "node:test";

import {
  debatePollStatus,
  teamVotePercent,
  winningTeamIds,
} from "../src/lib/classes-shared.ts";

test("debatePollStatus distinguishes pending, open, and closed polls", () => {
  assert.equal(
    debatePollStatus({ isOpen: false, openedAt: null, closedAt: null, totalVotes: 0 }),
    "pending",
  );
  assert.equal(
    debatePollStatus({
      isOpen: true,
      openedAt: "2026-11-24T10:00:00.000Z",
      closedAt: null,
      totalVotes: 0,
    }),
    "open",
  );
  assert.equal(
    debatePollStatus({
      isOpen: false,
      openedAt: "2026-11-24T10:00:00.000Z",
      closedAt: "2026-11-24T10:15:00.000Z",
      totalVotes: 5,
    }),
    "closed",
  );
  assert.equal(
    debatePollStatus({ isOpen: false, openedAt: null, closedAt: null, totalVotes: 1 }),
    "closed",
  );
});

test("teamVotePercent rounds share safely and handles zero totals", () => {
  assert.equal(teamVotePercent(0, 0), 0);
  assert.equal(teamVotePercent(3, 0), 0);
  assert.equal(teamVotePercent(0, 5), 0);
  assert.equal(teamVotePercent(1, 3), 33);
  assert.equal(teamVotePercent(2, 3), 67);
  assert.equal(teamVotePercent(4, 4), 100);
});

test("winningTeamIds handles empty, single winner, and tie", () => {
  assert.deepEqual(
    winningTeamIds([
      { id: "openness-velocity", votes: 0 },
      { id: "regulation", votes: 0 },
    ]),
    [],
  );
  assert.deepEqual(
    winningTeamIds([
      { id: "openness-velocity", votes: 7 },
      { id: "regulation", votes: 4 },
    ]),
    ["openness-velocity"],
  );
  assert.deepEqual(
    winningTeamIds([
      { id: "openness-velocity", votes: 5 },
      { id: "regulation", votes: 5 },
    ]),
    ["openness-velocity", "regulation"],
  );
});
