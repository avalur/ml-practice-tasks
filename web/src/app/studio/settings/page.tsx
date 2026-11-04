import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { teacherState } from "@/lib/teachers";
import { dailyLimit, platformEndpoints, today, type AiKeyStatus, type AiProviderId } from "@/lib/ai";
import { AiKeyForm } from "@/components/AiKeyForm";

export const metadata: Metadata = { title: "AI settings — Studio" };

export default async function StudioSettingsPage() {
  if ((await teacherState()).kind !== "active") redirect("/teach");
  const session = await auth();
  const userId = session!.user!.id!;

  const [cred, usage] = await Promise.all([
    prisma.aiCredential.findUnique({ where: { userId } }),
    prisma.aiUsage.findUnique({ where: { userId_day: { userId, day: today() } } }),
  ]);
  const status: AiKeyStatus = {
    own: cred
      ? { provider: cred.provider as AiProviderId, model: cred.model, hint: cred.keyHint, baseUrl: cred.baseUrl }
      : null,
    platform: {
      available: platformEndpoints().length > 0,
      model: platformEndpoints()[0]?.model ?? null,
      limit: dailyLimit(),
      usedToday: usage?.platform ?? 0,
    },
  };

  return (
    <article className="studio teach">
      <p className="muted class-breadcrumb">
        <Link href="/studio">Studio</Link> › AI settings
      </p>
      <h1>AI settings</h1>
      <h2>The site&rsquo;s model</h2>
      {status.platform.available ? (
        <p>
          Available to every teacher at no cost to you, {status.platform.limit} requests a day
          {status.platform.model ? (
            <>
              {" "}
              (<code>{status.platform.model}</code>)
            </>
          ) : null}
          . You have used <strong>{status.platform.usedToday}</strong> today (resets at midnight UTC). Requests go to a
          third-party provider, so keep student data out of them.
        </p>
      ) : (
        <p className="muted">Not configured on this site — add your own key below to use the builder.</p>
      )}
      <h2>Your own key</h2>
      <p className="muted">
        With your own key there is no daily limit, and you choose the model. It is stored encrypted and used only for
        your requests. Subscriptions such as ChatGPT Plus or Claude Pro cannot be connected — an API key is needed; an
        OpenRouter key gives access to most models with one account.
      </p>
      {status.own && (
        <p data-testid="ai-key-status">
          Using <strong>{status.own.provider}</strong> · <code>{status.own.model}</code> · key …{status.own.hint}
          {usage?.own ? ` · ${usage.own} requests today` : ""}
        </p>
      )}
      <AiKeyForm status={status} />
    </article>
  );
}
