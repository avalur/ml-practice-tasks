/* First/last name handling.
 *
 * A name is stored twice on purpose: firstName/lastName are what the user
 * types, `name` is the display string every other page already reads. Writing
 * both keeps Google/GitHub accounts — which arrive with only a `name` — working
 * untouched until their owner edits them here. */

export const MAX_NAME_PART = 60;

export function cleanNamePart(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
}

/** Human-readable reason these names are unacceptable, or null if they are fine.
 *
 *  Deliberately a rejection rather than a silent truncation: the edit form is
 *  prefilled from whatever Google supplied, and quietly cutting a name the user
 *  never touched — because they came to fix the *other* field — is how people
 *  lose half their surname. */
export function nameProblem(first: string, last: string): string | null {
  for (const [label, value] of [["First name", first], ["Last name", last]] as const) {
    if (value.length > MAX_NAME_PART) {
      return `${label} is too long (at most ${MAX_NAME_PART} characters).`;
    }
  }
  return null;
}

export function displayName(first: string, last: string, fallback: string): string {
  return [first, last].filter(Boolean).join(" ") || fallback;
}

/** What to prefill the edit form with. Accounts created before the split (and
 *  every OAuth one) have only `name`, so show it back split on the first space
 *  rather than an empty form. */
export function splitName(user: {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
}): { first: string; last: string } {
  if (user.firstName || user.lastName) {
    return { first: user.firstName ?? "", last: user.lastName ?? "" };
  }
  const parts = (user.name ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}
