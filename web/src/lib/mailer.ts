/* Outgoing mail, currently one letter: the password-reset link.
 *
 * Resend over plain fetch — no SDK, no nodemailer, nothing to keep working on a
 * serverless runtime. With no API key configured (local development, CI) the
 * message is printed to the server log instead, so the whole reset flow can be
 * walked through without an email account.
 */

const ENDPOINT = "https://api.resend.com/emails";

export type Mail = { to: string; subject: string; text: string; html: string };

export function mailerConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendMail(mail: Mail): Promise<{ sent: boolean; via: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM ?? "ML Practice <noreply@mlpractice.com>";

  if (!key) {
    // Not an error: this is the local path. Print the whole letter, because the
    // link inside it is the only way to continue the flow.
    console.warn(
      `[mail] RESEND_API_KEY is unset — not sending. Letter for ${mail.to}:\n` +
        `subject: ${mail.subject}\n${mail.text}`,
    );
    return { sent: false, via: "console" };
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
  });
  if (!res.ok) {
    // Callers deliberately do not surface this: whether an address exists, and
    // whether our mail provider is having a day, are both none of a visitor's
    // business. It has to be greppable in the logs, though.
    console.error(`[mail] Resend refused (${res.status}): ${await res.text()}`);
    return { sent: false, via: "resend" };
  }
  // Log the accepted id: with the failure path silent to the user, this line is
  // the only way to tell "we sent it" from "it never left".
  const id = ((await res.json().catch(() => ({}))) as { id?: string }).id ?? "?";
  console.log(`[mail] sent "${mail.subject}" (resend id ${id})`);
  return { sent: true, via: "resend" };
}

/** The one letter, in both flavours. */
export function resetEmail(link: string, ttlMinutes: number): Omit<Mail, "to"> {
  const text =
    `Someone asked to reset the password for your ML Practice account.\n\n` +
    `Open this link to choose a new one (valid for ${ttlMinutes} minutes, once):\n` +
    `${link}\n\n` +
    `If it wasn't you, ignore this email — nothing has changed.\n`;
  const html =
    `<p>Someone asked to reset the password for your ML Practice account.</p>` +
    `<p><a href="${link}">Choose a new password</a> — the link is valid for ` +
    `${ttlMinutes} minutes and can be used once.</p>` +
    `<p style="color:#666">If it wasn't you, ignore this email — nothing has changed.</p>`;
  return { subject: "Reset your ML Practice password", text, html };
}
