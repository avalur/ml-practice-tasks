import { notFound } from "next/navigation";
import type { Metadata } from "next";
import manifest from "../../../../../../notebooks/manifest.json";
import { auth } from "@/auth";
import { NotebookFrame } from "@/components/NotebookFrame";

type Params = { section: string; slug: string };

export function generateStaticParams(): Params[] {
  return manifest.sections.flatMap((s) =>
    s.notebooks.map((nb) => ({ section: s.slug, slug: nb.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { section, slug } = await params;
  const sec = manifest.sections.find((s) => s.slug === section);
  const nb = sec?.notebooks.find((n) => n.slug === slug);
  return {
    title: nb ? `${nb.title} — ML Practice` : "Notebook",
  };
}

export default async function NotebookPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { section, slug } = await params;
  const sec = manifest.sections.find((s) => s.slug === section);
  const nb = sec?.notebooks.find((n) => n.slug === slug);
  if (!nb) notFound();

  const session = await auth();
  const src = `/notebooks/${section}/${slug}/index.html`;

  return (
    <NotebookFrame
      src={src}
      notebookId={`${section}/${slug}`}
      title={nb.title}
      canReset={!!session?.user}
    />
  );
}
