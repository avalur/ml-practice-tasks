// Pure, client-safe problem types and helpers — NO node:* imports, so this can
// be imported from both server and client components. Filesystem access lives
// in lib/content.ts (server only).

export type Banned = {
  modules?: string[];
  names?: string[];
  loops?: boolean;
};

export type Difficulty = "easy" | "medium" | "hard";

export type ProblemMeta = {
  id: string;
  topic: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  entry: string;
  banned: Banned;
  statementMd: string;
  bundlePath: string;
  pyDeps: string[];
  webRunnable: boolean;
  /** Unlisted: kept in the manifest (so it stays SSG-built and solvable by
   *  direct URL) but filtered out of the catalog, sidebar and prev/next nav. */
  hidden?: boolean;
  hints: string[];
  prereqs: string[];
  next: string[];
  contentHash: string;
};

export type Manifest = {
  topics: string[];
  difficulties: Difficulty[];
  problems: ProblemMeta[];
};

/** Problems shown in nav/lists — everything not flagged `hidden`. */
export function visibleProblems(manifest: Manifest): ProblemMeta[] {
  return manifest.problems.filter((p) => !p.hidden);
}

/** Human-readable one-line summary of a problem's constraints. */
export function constraintSummary(banned: Banned): string[] {
  const out: string[] = [];
  if (banned.modules?.length) out.push(`no ${banned.modules.join(", ")}`);
  if (banned.names?.length) out.push(`no ${banned.names.join(", ")}`);
  if (banned.loops) out.push("no for/while loops");
  return out;
}
