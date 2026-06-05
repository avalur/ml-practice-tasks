// Upsert Problem rows from the committed manifest so submissions/progress have a
// valid FK target. Run locally via `pnpm db:sync-problems`; in CI/prod run with
// the platform's DATABASE_URL as a gated release step.
const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs");
const path = require("node:path");

const prisma = new PrismaClient();

(async () => {
  const manifestPath = path.join(
    __dirname,
    "..",
    "public",
    "content",
    "manifest.json",
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  let n = 0;
  for (const p of manifest.problems) {
    const fields = {
      topic: p.topic,
      slug: p.slug,
      title: p.title,
      difficulty: p.difficulty,
      contentHash: p.contentHash,
    };
    await prisma.problem.upsert({
      where: { id: p.id },
      create: { id: p.id, ...fields },
      update: fields,
    });
    n++;
  }
  console.log(`Synced ${n} problems.`);
})()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
