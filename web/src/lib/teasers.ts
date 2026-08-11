import { cache } from "react";

import { prisma } from "@/lib/db";
import { isSiteAdmin } from "@/lib/admin";

/** Every teaser that can be hidden. A teaser not listed here is simply public,
 *  like the two puzzles that predate this. */
export const GATED_TEASERS = ["abacus"] as const;
export type GatedTeaser = (typeof GATED_TEASERS)[number];

export function isGatedTeaser(slug: string): slug is GatedTeaser {
  return (GATED_TEASERS as readonly string[]).includes(slug);
}

export type TeaserAccess = {
  published: boolean;
  admin: boolean;
  /** The only question the pages ask: published, or it's your own draft. */
  visible: boolean;
};

/* Memoised per request: a page resolves this in generateMetadata and again in
 * the body, and each call is a session lookup plus a row read. */
export const teaserAccess = cache(async function teaserAccess(
  slug: string,
): Promise<TeaserAccess> {
  const [row, admin] = await Promise.all([
    prisma.teaserState.findUnique({ where: { slug }, select: { publishedAt: true } }),
    isSiteAdmin(),
  ]);
  // No row at all means draft — a teaser is on the site only once somebody has
  // said so, so a new one cannot go live by being deployed.
  const published = !!row?.publishedAt;
  return { published, admin, visible: published || admin };
});

export async function setTeaserPublished(slug: string, published: boolean): Promise<Date | null> {
  const publishedAt = published ? new Date() : null;
  const row = await prisma.teaserState.upsert({
    where: { slug },
    create: { slug, publishedAt },
    update: { publishedAt },
    select: { publishedAt: true },
  });
  return row.publishedAt;
}
