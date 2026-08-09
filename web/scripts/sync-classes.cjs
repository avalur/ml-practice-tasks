// Upsert Class rows from the committed classes/ manifests so enrollments,
// lesson sessions and annotations have a valid FK target. Mirrors
// sync-problems.cjs: run locally via `pnpm db:sync-classes`; in CI/prod run
// with the platform's DATABASE_URL as a gated release step.
//
// The invite code is generated once, on create, and never rewritten — a
// re-sync must not invalidate a code the students already have.
const { PrismaClient } = require("@prisma/client");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const prisma = new PrismaClient();
const CLASSES = path.join(__dirname, "..", "..", "classes");

// Ambiguous glyphs (0/O, 1/I/L) are left out: these codes get read out loud.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function inviteCode(len = 6) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

async function uniqueInviteCode() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = inviteCode();
    const clash = await prisma.class.findUnique({ where: { inviteCode: code } });
    if (!clash) return code;
  }
  throw new Error("could not generate a free invite code");
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
        inviteCode: await uniqueInviteCode(),
      },
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

    console.log(
      `${existing ? "updated" : "created"} ${row.slug}  ` +
        `invite=${row.inviteCode}  lessons=${(cfg.lessons || []).length}  ` +
        `teachers=${teacherEmails.length} (${enrolled} enrolled)`,
    );
  }
})()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
