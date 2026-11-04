#!/usr/bin/env node
/* pnpm db:proposal <id> [--dry-run]
 *
 * Turn an accepted task proposal into problems/<topic>/<slug>/{reference,test,
 * meta}.py — the source-of-truth layout every hand-written task has — and mark
 * it imported. Nothing is committed: run `python generate.py` and
 * `pytest problems/<topic>/<slug>` next, read the diff, then commit as usual.
 *
 * Refuses a proposal that is not accepted, and a directory that already
 * exists, so it can never overwrite a real task. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

import { metaPy } from "../src/lib/proposal-shared.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..");
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const dry = args.includes("--dry-run");
if (!id) {
  console.error("usage: pnpm db:proposal <proposal id> [--dry-run]");
  process.exit(2);
}

const prisma = new PrismaClient();
try {
  const p = await prisma.problemProposal.findUnique({ where: { id }, include: { user: { select: { email: true } } } });
  if (!p) throw new Error(`no proposal ${id}`);
  if (p.status !== "accepted") throw new Error(`proposal ${id} is ${p.status}, not accepted`);
  if (!/^[a-z][a-z0-9_]*$/.test(p.topic) || !/^[a-z][a-z0-9_]*$/.test(p.slug)) {
    throw new Error(`bad topic/slug ${p.topic}/${p.slug}`);
  }
  const dir = path.join(ROOT, "problems", p.topic, p.slug);
  if (fs.existsSync(dir)) throw new Error(`${path.relative(ROOT, dir)} already exists`);

  const meta = metaPy({
    title: p.title,
    topic: p.topic,
    difficulty: p.difficulty,
    entry: p.entry,
    statement: p.statement,
    reference: p.reference,
    test: p.test,
    banned: p.banned ?? {},
    pyDeps: p.pyDeps ?? ["numpy"],
  });
  const files = {
    "reference.py": p.reference.endsWith("\n") ? p.reference : p.reference + "\n",
    "test.py": p.test.endsWith("\n") ? p.test : p.test + "\n",
    "meta.py": `# Proposed by ${p.user.email ?? p.userId} via the Studio (proposal ${p.id}).\n${meta}`,
  };
  if (dry) {
    for (const [name, text] of Object.entries(files)) console.log(`--- ${name}\n${text}`);
  } else {
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
    await prisma.problemProposal.update({ where: { id }, data: { status: "imported" } });
    const rel = path.relative(ROOT, dir);
    console.log(`Wrote ${rel}/. Next:\n  python generate.py\n  pytest ${rel}\n  pytest tasks/${p.topic}/${p.slug}   # the stub must fail\nthen review the diff, commit, and pnpm db:sync-problems after the push.`);
  }
} catch (e) {
  console.error(String(e.message ?? e));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
