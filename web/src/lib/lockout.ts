import { prisma } from "@/lib/db";

/* Account lockout after repeated wrong passwords, shared by sign-in and
 * password change so both count against the same limit.
 *
 * The count is incremented in the database, never written back from a value
 * read earlier: concurrent wrong guesses would each store "n + 1" and stay
 * under the limit forever. And a failure only ever sets the lock — a stale
 * request must not clear a lock a parallel one has just set. */

export const MAX_ATTEMPTS = 8;
export const LOCK_MINUTES = 15;

export async function recordFailedPassword(userId: string): Promise<void> {
  const { failedLogins } = await prisma.user.update({
    where: { id: userId },
    data: { failedLogins: { increment: 1 } },
    select: { failedLogins: true },
  });
  if (failedLogins >= MAX_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) },
    });
  }
}
