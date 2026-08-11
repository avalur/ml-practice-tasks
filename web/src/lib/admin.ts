import { cache } from "react";

import { auth } from "@/auth";

/* Who may edit the site itself — publish a brain teaser, and whatever comes
 * next. Classes have their own answer (`Class.teacherEmails`, seeded per class);
 * this is the site-wide one, and it is deliberately an env var rather than a
 * column: the list changes by editing ADMIN_EMAILS in Vercel, no migration and
 * nobody to grant it in the UI.
 *
 * Unset or empty means **nobody**. A deploy that forgets the variable hides the
 * Publish button; it does not hand it to everyone. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const isSiteAdmin = cache(async function isSiteAdmin(): Promise<boolean> {
  const emails = adminEmails();
  if (emails.length === 0) return false;
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  return !!email && emails.includes(email);
});
