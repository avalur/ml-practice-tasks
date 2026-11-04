import { cache } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { adminEmails, isSiteAdmin } from "@/lib/admin";
import { sendMail, type Mail } from "@/lib/mailer";
import { TEACHER_TERMS_VERSION } from "@/content/teacher-terms";

/* The platform-wide teacher role: who may build courses of their own.
 *
 * Three levels of authority, from widest to narrowest:
 *   - site admin  — ADMIN_EMAILS; grants this role, moderates every class;
 *   - teacher     — a live TeacherGrant whose terms are current; builds courses;
 *   - class teacher — an email in Class.teacherEmails; runs that one class.
 * The last one predates this file and is untouched by it: the hand-written
 * repo courses keep authorizing exactly as before. */

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Loose on purpose — the address is a key, not something we mail blindly. */
export function looksLikeEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) && raw.length <= 254;
}

export * from "./teacher-shared";

export type TeacherState =
  | { kind: "anonymous" }
  /** Never applied, or the last application was rejected. */
  | { kind: "none"; rejected: { note: string | null; at: Date } | null }
  | { kind: "pending"; since: Date }
  | { kind: "revoked"; at: Date }
  /** Granted, but has not accepted the current version of the terms yet. */
  | { kind: "terms"; previouslyAccepted: boolean }
  | { kind: "active"; since: Date };

const currentSession = cache(auth);

/** Where the caller stands on the way to teaching, in one place for /teach and
 * for every route that needs the role. */
export const teacherState = cache(async function teacherState(): Promise<TeacherState> {
  const session = await currentSession();
  const userId = session?.user?.id;
  const email = session?.user?.email ? normalizeEmail(session.user.email) : null;
  if (!userId || !email) return { kind: "anonymous" };

  const [grant, application] = await Promise.all([
    prisma.teacherGrant.findUnique({ where: { email } }),
    prisma.teacherApplication.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { status: true, createdAt: true, reviewNote: true, reviewedAt: true },
    }),
  ]);

  if (grant && !grant.revokedAt) {
    return grant.termsVersion === TEACHER_TERMS_VERSION
      ? { kind: "active", since: grant.grantedAt }
      : { kind: "terms", previouslyAccepted: grant.termsVersion !== null };
  }
  // A pending application outranks an old revocation: re-applying is how a
  // revoked teacher asks to come back.
  if (application?.status === "pending") return { kind: "pending", since: application.createdAt };
  if (grant?.revokedAt) return { kind: "revoked", at: grant.revokedAt };
  if (application?.status === "rejected") {
    return {
      kind: "none",
      rejected: { note: application.reviewNote, at: application.reviewedAt ?? application.createdAt },
    };
  }
  return { kind: "none", rejected: null };
});

/** The gate for everything a platform teacher can do. */
export async function isPlatformTeacher(): Promise<boolean> {
  return (await teacherState()).kind === "active";
}

/** Grant (or restore) the role. Terms already accepted stay accepted: a teacher
 * who was revoked and let back in does not need to click through them again
 * unless they have changed since. */
export async function grantTeacher(email: string, by: string) {
  const key = normalizeEmail(email);
  return prisma.teacherGrant.upsert({
    where: { email: key },
    create: { email: key, grantedBy: by },
    update: { grantedBy: by, grantedAt: new Date(), revokedAt: null, revokedBy: null },
  });
}

/** Letters to every site admin. Best effort, like all mail here: a moderation
 * queue that cannot email still works, it is just looked at less often. */
export async function mailAdmins(letter: Omit<Mail, "to">): Promise<void> {
  await Promise.all(adminEmails().map((to) => sendMail({ ...letter, to }).catch(() => null)));
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Admin email, or null when the caller is not one. */
export async function adminEmail(): Promise<string | null> {
  if (!(await isSiteAdmin())) return null;
  const session = await currentSession();
  return session?.user?.email ? normalizeEmail(session.user.email) : null;
}

/* --------------------------------------------------------------- letters */

export function grantedLetter(link: string): Omit<Mail, "to"> {
  return {
    subject: "You can now teach on ML Practice",
    text:
      `You have been given the teacher role on ML Practice.\n\n` +
      `Open ${link} to read and accept the teacher terms; after that you can start building a course.\n`,
    html:
      `<p>You have been given the teacher role on ML Practice.</p>` +
      `<p><a href="${link}">Read and accept the teacher terms</a> — after that you can start building a course.</p>`,
  };
}

export function rejectedLetter(link: string, note: string | null): Omit<Mail, "to"> {
  const why = note ? `\n\nFrom the reviewer:\n${note}\n` : "\n";
  return {
    subject: "Your teacher application on ML Practice",
    text:
      `Thank you for applying to teach on ML Practice. We are not able to approve the application this time.` +
      `${why}\nYou can apply again at ${link}.\n`,
    html:
      `<p>Thank you for applying to teach on ML Practice. We are not able to approve the application this time.</p>` +
      (note ? `<p>From the reviewer:</p><blockquote>${escapeHtml(note)}</blockquote>` : "") +
      `<p>You can <a href="${link}">apply again</a>.</p>`,
  };
}
