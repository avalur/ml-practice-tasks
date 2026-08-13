import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { normalizeCode } from "@/lib/classes";
import { ABACUS } from "@/content/abacus";
import {
  isLevel,
  scoreOf,
  type BoardDTO,
  type Level,
  type VerdictDTO,
} from "@/lib/abacus";

export type { BoardDTO, TeamDTO, VerdictDTO } from "@/lib/abacus";

/* A live abacus event: one code, up to a handful of teams, one jury.
 *
 * Teams have no accounts. The code is the invitation and this cookie is the
 * identity — one browser, one team. That is the deal the Kahoot shape buys: a
 * room of ten-year-olds is playing within a minute, and a team that clears its
 * cookies joins again under another name. */
export const TEAM_COOKIE = "mlp_abacus_team";
const TEAM_COOKIE_DAYS = 2;

/* Codes get dictated across a room, so no O/0 or I/1, and a dash in the middle
 * to make it speakable. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCode(): string {
  const pick = (n: number) =>
    Array.from(randomBytes(n), (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${pick(3)}-${pick(3)}`;
}

export function newToken(): string {
  return randomBytes(32).toString("hex");
}

export function teamCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure,
    maxAge: TEAM_COOKIE_DAYS * 24 * 60 * 60,
  };
}

/** The themes of one level, in board order — what a grid needs to draw. */
export function themesOf(level: Level): Array<{ id: string; titleRu: string; titleEn: string; points: number[] }> {
  const variant = ABACUS.variants.find((v) => v.level === level) ?? ABACUS.variants[0];
  return variant.themes.map((t) => ({
    id: t.id,
    titleRu: t.title.ru,
    titleEn: t.title.en,
    points: t.problems.map((p) => p.points),
  }));
}

/** What a cell is worth on this level, or null if there is no such cell. */
export function cellPoints(level: Level, themeId: string, index: number): number | null {
  const theme = themesOf(level).find((t) => t.id === themeId);
  if (!theme) return null;
  return theme.points[index] ?? null;
}

export async function sessionByCode(code: string) {
  const key = normalizeCode(code);
  if (!key) return null;
  return prisma.abacusSession.findUnique({ where: { codeKey: key } });
}

/** Everything the monitor, the team page and the marking grid render from. */
export async function readBoard(sessionId: string, code: string, title: string | null, closedAt: Date | null): Promise<BoardDTO> {
  // Stamped *before* the query, not after: a screen decides whether an arriving
  // board is newer than the one it shows, and a timestamp taken after a slow
  // round trip would claim data it never saw.
  const now = new Date().toISOString();
  const teams = await prisma.abacusTeam.findMany({
    where: { sessionId },
    orderBy: { joinedAt: "asc" },
    select: {
      id: true,
      name: true,
      level: true,
      verdicts: {
        select: { themeId: true, index: true, correct: true, points: true },
        orderBy: { at: "asc" },
      },
    },
  });

  return {
    code,
    title,
    closed: closedAt !== null,
    now,
    teams: teams.map((t) => {
      const verdicts = t.verdicts.map((v) => ({ ...v }));
      return {
        id: t.id,
        name: t.name,
        level: isLevel(t.level) ? t.level : "hard",
        score: scoreOf(verdicts),
        verdicts,
      };
    }),
  };
}

/** The team whose cookie this browser carries, if that team still exists. */
export async function currentTeam() {
  const jar = await cookies();
  const token = jar.get(TEAM_COOKIE)?.value;
  if (!token) return null;
  return prisma.abacusTeam.findUnique({
    where: { token },
    select: {
      id: true,
      name: true,
      level: true,
      session: { select: { id: true, code: true, title: true, closedAt: true } },
    },
  });
}
