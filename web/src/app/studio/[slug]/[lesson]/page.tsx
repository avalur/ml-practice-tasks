import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { getManifest } from "@/lib/content";
import { editableClass, type StudioHomeworkInput, type StudioItemInput } from "@/lib/studio";
import notebookManifest from "../../../../../../notebooks/manifest.json";
import { LessonEditor, type CatalogEntry } from "@/components/LessonEditor";

export const metadata: Metadata = { title: "Lesson — Studio" };

type NotebookManifest = { sections: { slug: string; notebooks: { slug: string; title?: string }[] }[] };

export default async function StudioLessonPage({
  params,
}: {
  params: Promise<{ slug: string; lesson: string }>;
}) {
  const { slug, lesson } = await params;
  const g = await editableClass(slug);
  if (!g.ok) notFound();

  const row = await prisma.studioLesson.findUnique({
    where: { classId_slug: { classId: g.cls.id, slug: lesson } },
    select: { slug: true, title: true, date: true, deck: true, practice: true, homework: true },
  });
  if (!row) notFound();

  // The whole catalogue goes to the picker: ~100 tasks and a handful of
  // notebooks, searched on the client as the teacher types.
  const manifest = await getManifest();
  const catalog: CatalogEntry[] = [
    ...manifest.problems
      .filter((p) => !p.hidden)
      .map((p) => ({ type: "problem" as const, id: p.id, title: p.title, difficulty: p.difficulty })),
    ...(notebookManifest as NotebookManifest).sections.flatMap((s) =>
      s.notebooks.map((n) => ({ type: "notebook" as const, id: `${s.slug}/${n.slug}`, title: n.title ?? n.slug })),
    ),
  ];

  return (
    <article className="studio studio-wide">
      <p className="muted class-breadcrumb">
        <Link href="/studio">Studio</Link> › <Link href={`/studio/${slug}`}>{g.cls.title}</Link> › {row.title}
      </p>
      <h1>{row.title}</h1>
      <p className="muted">
        Students see this lesson at <Link href={`/classes/${slug}/lessons/${row.slug}`}>/classes/{slug}/lessons/{row.slug}</Link>.
      </p>
      <LessonEditor
        courseSlug={slug}
        courseTitle={g.cls.title}
        catalog={catalog}
        lesson={{
          slug: row.slug,
          title: row.title,
          date: row.date,
          deck: row.deck,
          practice: (row.practice as StudioItemInput[]) ?? [],
          homework: (row.homework as StudioHomeworkInput) ?? null,
        }}
      />
    </article>
  );
}
