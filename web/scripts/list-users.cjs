// Who has registered, newest first. Read-only — run it against prod whenever you
// want to know who is on the site: `pnpm db:users` (add `--limit N`, default 50).
//
// Deliberately never printed: passwordHash, session tokens and reset tokens. The
// column you want is "via", which says *how* the account signs in — a password,
// an OAuth provider, or both — and that is derivable without touching the secret.
//
// "address" is not User.emailVerified. That column is written in exactly one
// place, the reset-password route, so it stays null for everyone who signed in
// with Google and reading it as "unverified" would libel every OAuth account on
// the site. What a teacher actually wants to know is whether the address is
// real: `oauth` means the provider vouched for it, `reset` means they followed a
// link we mailed them, `unproven` means nobody has checked.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const value = Number(process.argv[i + 1]);
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`--${name} needs a positive number`);
    process.exit(1);
  }
  return value;
}

const pad = (s, n) => String(s ?? "").padEnd(n).slice(0, n);
const day = (d) => (d ? d.toISOString().slice(0, 10) : "—");

(async () => {
  const limit = arg("limit", 50);
  const total = await prisma.user.count();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      name: true, firstName: true, lastName: true, email: true,
      emailVerified: true, createdAt: true,
      // Presence only — the hash itself never leaves the database.
      passwordHash: true,
      accounts: { select: { provider: true } },
      enrollments: {
        select: { class: { select: { slug: true } }, invite: { select: { label: true } } },
      },
      _count: { select: { progress: true, notebookProgress: true } },
    },
  });

  const shown = users.map((u) => {
    const via = [
      u.passwordHash ? "password" : null,
      ...u.accounts.map((a) => a.provider),
    ].filter(Boolean);
    return {
      when: day(u.createdAt),
      name: u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || "—",
      email: u.email ?? "—",
      via: via.length ? via.join("+") : "none",
      addr: u.accounts.length ? "oauth" : u.emailVerified ? "reset" : "unproven",
      solved: u._count.progress + u._count.notebookProgress,
      classes: u.enrollments
        .map((e) => e.class.slug + (e.invite ? ` (${e.invite.label})` : ""))
        .join(", ") || "—",
    };
  });

  const w = {
    when: 10,
    name: Math.max(4, ...shown.map((r) => r.name.length)),
    email: Math.max(5, ...shown.map((r) => r.email.length)),
    via: Math.max(3, ...shown.map((r) => r.via.length)),
  };

  console.log(
    `${pad("registered", w.when)}  ${pad("name", w.name)}  ${pad("email", w.email)}  ` +
      `${pad("via", w.via)}  address   tasks  classes`,
  );
  for (const r of shown) {
    console.log(
      `${pad(r.when, w.when)}  ${pad(r.name, w.name)}  ${pad(r.email, w.email)}  ` +
        `${pad(r.via, w.via)}  ${pad(r.addr, 8)}  ${pad(r.solved, 5)}  ${r.classes}`,
    );
  }

  // Signed up and never solved anything is the bounce number — someone who made
  // an account and did not start. Kept separate from the address question.
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [week, withPassword, noTasks, synthetic] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { passwordHash: { not: null } } }),
    prisma.user.count({ where: { progress: { none: {} }, notebookProgress: { none: {} } } }),
    prisma.user.count({ where: { email: { endsWith: "@example.test" } } }),
  ]);
  console.log(
    `\n${total} accounts (${shown.length} shown) · ${week} in the last 7 days · ` +
      `${withPassword} with a password · ${noTasks} solved nothing yet`,
  );
  if (synthetic) {
    // signInAs() deletes its account on dispose, so one left behind means a run
    // was killed mid-test. Harmless, but it is not a person.
    console.log(
      `${synthetic} @example.test account(s) left over from an interrupted e2e run`,
    );
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e.message);
  await prisma.$disconnect();
  process.exit(1);
});
