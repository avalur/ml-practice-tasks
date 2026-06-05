import { promises as fs } from "node:fs";
import path from "node:path";

import type { Manifest, ProblemMeta } from "./problem";

// Convenience re-exports so server components can grab types from one place.
export type { Banned, Difficulty, Manifest, ProblemMeta } from "./problem";

// Generated, committed content lives under web/public/content (see export_web.py).
// process.cwd() is the web/ package root during dev/build.
const CONTENT_DIR = path.join(process.cwd(), "public", "content");

export async function getManifest(): Promise<Manifest> {
  const raw = await fs.readFile(path.join(CONTENT_DIR, "manifest.json"), "utf8");
  return JSON.parse(raw) as Manifest;
}

export async function getProblem(
  topic: string,
  slug: string,
): Promise<ProblemMeta | null> {
  const manifest = await getManifest();
  return manifest.problems.find((p) => p.topic === topic && p.slug === slug) ?? null;
}

export async function getStarterCode(topic: string, slug: string): Promise<string> {
  return fs.readFile(
    path.join(CONTENT_DIR, "problems", topic, slug, "submission.py"),
    "utf8",
  );
}
