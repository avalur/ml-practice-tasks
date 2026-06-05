import { prisma } from "@/lib/db";

const DAY_MS = 86_400_000;
const dayStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Current solving streak: consecutive UTC days (ending today, or yesterday if
 * nothing solved yet today) on which the user solved at least one problem.
 */
export async function computeStreak(userId: string): Promise<number> {
  const subs = await prisma.submission.findMany({
    where: { userId, clientStatus: "passed" },
    select: { createdAt: true },
  });
  const days = new Set(subs.map((s) => s.createdAt.toISOString().slice(0, 10)));
  if (days.size === 0) return 0;

  const today = new Date(dayStr(Date.now()) + "T00:00:00Z").getTime();
  let cursor = days.has(dayStr(today)) ? today : today - DAY_MS;
  let streak = 0;
  while (days.has(dayStr(cursor))) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}
