// Upsert Class rows from the committed classes/ manifests so enrollments,
// lesson sessions and annotations have a valid FK target. Mirrors
// sync-problems.cjs: run locally via `pnpm db:sync-classes`; in CI/prod run
// with the platform's DATABASE_URL as a gated release step.
//
// Group invite codes are NOT seeded here: the teacher writes them on the
// homework page, because a code is read out to a room and "TLF-OSEN-A" beats
// anything a random generator produces. A class with no codes yet is fine —
// everything about it is public anyway.
const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs");
const path = require("node:path");

const prisma = new PrismaClient();
const CLASSES = path.join(__dirname, "..", "..", "classes");

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
      create: { slug: entry.slug, title: cfg.title || entry.title, teacherEmails },
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
        `lessons=${(cfg.lessons || []).length}  codes=${codes}  ` +
        `teachers=${teacherEmails.length} (${enrolled} enrolled)`,
    );
  }
})()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
