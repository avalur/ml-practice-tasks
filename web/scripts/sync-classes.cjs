// Upsert Class rows from the committed classes/ manifests so enrollments,
// lesson sessions and annotations have a valid FK target. Mirrors
// sync-problems.cjs: run locally via `pnpm db:sync-classes`; in CI/prod run
// with the platform's DATABASE_URL as a gated release step.
//
// Group invite codes are NOT seeded here: the teacher writes them on the
// homework page, because a code is read out to a room and "TLF-OSEN-A" beats
// anything a random generator produces. A class with no codes yet is fine —
// everything about it is public anyway.
//
// Neither is publication. `"draft": true` in class.json picks the state the row
// is *created* with; after that Class.publishedAt is the truth and this script
// only reports a disagreement, never resolves it. Otherwise a routine sync could
// hide a running course, or undo a Publish the teacher pressed an hour ago.
// Changing it from here is explicit:
//
//   pnpm db:sync-classes --publish <slug>
//   pnpm db:sync-classes --unpublish <slug>
const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs");
const path = require("node:path");

const prisma = new PrismaClient();
const CLASSES = path.join(__dirname, "..", "..", "classes");

/** Value of `--flag <slug>`, or null. A flag with nothing after it is an error,
 *  not a silent no-op: it would otherwise look like the class was published. */
function flag(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return null;
  const value = process.argv[i + 1];
  if (!value || value.startsWith("--")) {
    console.error(`--${name} needs a class slug`);
    process.exitCode = 1;
    return null;
  }
  return value;
}

(async () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(CLASSES, "manifest.json"), "utf8"),
  );

  for (const entry of manifest.classes) {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(CLASSES, entry.slug, "class.json"), "utf8"),
    );
    const teacherEmails = (cfg.teacherEmails || []).map((e) => e.toLowerCase());

    const existing = await prisma.class.findUnique({ where: { slug: entry.slug } });
    const row = await prisma.class.upsert({
      where: { slug: entry.slug },
      create: {
        slug: entry.slug,
        title: cfg.title || entry.title,
        teacherEmails,
        // The file's only say in publication, and only for a brand-new class.
        publishedAt: cfg.draft ? null : new Date(),
      },
      // Deliberately no publishedAt: see the header comment.
      update: { title: cfg.title || entry.title, teacherEmails },
    });

    // Enroll teachers so they appear in their own rosters. Authorization does
    // not depend on this row (teacherEmails is the source of truth), so a
    // teacher who has never signed in is simply skipped until they do.
    let enrolled = 0;
    for (const email of teacherEmails) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) continue;
      await prisma.classEnrollment.upsert({
        where: { classId_userId: { classId: row.id, userId: user.id } },
        create: { classId: row.id, userId: user.id },
        update: {},
      });
      enrolled++;
    }

    const codes = await prisma.classInvite.count({ where: { classId: row.id } });
    console.log(
      `${existing ? "updated" : "created"} ${row.slug}  ` +
        `${row.publishedAt ? "published" : "draft"}  ` +
        `lessons=${(cfg.lessons || []).length}  codes=${codes}  ` +
        `teachers=${teacherEmails.length} (${enrolled} enrolled)`,
    );

    // Report, don't resolve: the file and the DB are allowed to disagree, and the
    // fix is a deliberate command either way.
    if (row.publishedAt && cfg.draft) {
      console.log(
        `  ⚠ class.json says draft, but the class is published — ` +
          `\`--unpublish ${row.slug}\` to hide it`,
      );
    } else if (!row.publishedAt && !cfg.draft) {
      console.log(
        `  ⚠ class.json does not say draft, but the class is hidden — ` +
          `press Publish on its page or \`--publish ${row.slug}\``,
      );
    }
  }

  for (const [name, value] of [
    ["publish", new Date()],
    ["unpublish", null],
  ]) {
    const slug = flag(name);
    if (!slug) continue;
    const updated = await prisma.class.updateMany({
      where: { slug },
      data: { publishedAt: value },
    });
    if (updated.count === 0) {
      console.error(`--${name}: no class with slug ${slug}`);
      process.exitCode = 1;
    } else {
      console.log(`${name}ed ${slug}`);
    }
  }
})()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
