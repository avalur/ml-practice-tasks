import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAccess, getClassMeta } from "@/lib/classes";
import { MonitorFeed } from "@/components/MonitorFeed";
import { PopOutButton } from "@/components/PopOutButton";
import { ClassTeacherNav } from "@/components/ClassTeacherNav";
import { PageHeader } from "@/components/ui";

type Params = { slug: string };

export const metadata: Metadata = {
  title: "Live monitor — ML Practice",
  robots: { index: false },
};

export default async function MonitorPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const cls = await getClassMeta(slug);
  if (!cls) notFound();

  const access = await getAccess(slug);
  if (!access.classRow) notFound();
  // Teacher-only by design: the feed carries named, per-student pass/fail data.
  if (!access.isTeacher) notFound();

  return (
    <article>
      <p className="muted class-breadcrumb">
        <Link href="/teach">Teaching</Link> › <Link href={`/classes/${slug}`}>{cls.title}</Link>
      </p>
      <PageHeader
        title={cls.title}
        actions={<PopOutButton url={`/classes/${slug}/monitor`} />}
      />
      <ClassTeacherNav
        slug={slug}
        classId={access.classRow.id}
        studio={access.studio}
        current="monitor"
      />
      <p className="muted">
        Runs by members of this class, refreshed every few seconds. Problems show
        every attempt; notebooks appear once solved, because marimo re-runs its
        checker on every keystroke and would otherwise flood the feed.
      </p>
      <MonitorFeed classSlug={slug} />
    </article>
  );
}
