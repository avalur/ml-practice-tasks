import Link from "next/link";

import { prisma } from "@/lib/db";
import { splitName } from "@/lib/person";
import { profileUser } from "@/lib/student";
import { ProfileNameForm } from "@/components/ProfileNameForm";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { Badge, Notice, PageHeader, Section } from "@/components/ui";

export const metadata = { title: "Account — ML Practice" };

const PROVIDER_LABEL: Record<string, string> = { google: "Google", github: "GitHub" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const me = await profileUser();
  if (!me) return null;
  const { saved } = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: {
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      passwordHash: true,
      createdAt: true,
      accounts: { select: { provider: true } },
    },
  });
  const { first, last } = splitName(user ?? {});
  const providers = [...new Set(user?.accounts.map((a) => a.provider) ?? [])];
  const hasPassword = !!user?.passwordHash;

  return (
    <>
      <PageHeader title="Account" subtitle="Your name is what your teacher sees next to your homework." />
      {saved === "1" && (
        <Notice tone="success" testId="account-saved">
          Saved.
        </Notice>
      )}

      <Section title="Name">
        <ProfileNameForm first={first} last={last} email={user?.email ?? null} />
      </Section>

      <Section title="Sign-in methods">
        <ul className="rows card" data-testid="sign-in-methods">
          {providers.map((p) => (
            <li key={p}>
              <span className="row-main row-title">{PROVIDER_LABEL[p] ?? p}</span>
              <Badge tone="success">connected</Badge>
            </li>
          ))}
          <li>
            <span className="row-main row-title">Email and password</span>
            {hasPassword ? (
              <Badge tone="success">set</Badge>
            ) : (
              <Badge tone="neutral">not set</Badge>
            )}
          </li>
        </ul>
      </Section>

      <Section title="Password">
        {hasPassword ? (
          <ChangePasswordForm />
        ) : (
          <p className="muted">
            You sign in with {providers.map((p) => PROVIDER_LABEL[p] ?? p).join(" or ") || "a provider"}.
            To add a password as well, <Link href="/forgot-password">request a link by email</Link> —
            following it is how we know the address is yours.
          </p>
        )}
      </Section>
    </>
  );
}
