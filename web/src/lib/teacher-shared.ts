/* Client-safe half of src/lib/teachers.ts: the limits and labels the forms
 * share with the routes that validate them. */

export const APPLICATION_LIMITS = { about: 2000, plans: 2000, link: 300, note: 1000 };

export const REPORT_REASONS = {
  phishing: "Asks for passwords, payment or personal data",
  harmful: "Harmful, hateful or adult content",
  spam: "Spam or advertising",
  copyright: "Copied from somebody else without permission",
  other: "Something else",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export const REPORT_DETAILS_MAX = 2000;
