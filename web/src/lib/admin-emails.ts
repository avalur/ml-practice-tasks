/* The ADMIN_EMAILS list, with no imports: auth.ts needs it for the session
 * callback, and lib/admin.ts imports auth — so it cannot live there. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && adminEmails().includes(email.toLowerCase());
}
