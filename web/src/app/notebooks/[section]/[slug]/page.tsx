import { notFound } from "next/navigation";
import type { Metadata } from "next";
import manifest from "../../../../../../notebooks/manifest.json";

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

  const src = `/notebooks/${section}/${slug}/index.html`;

  return (
    <div className="notebook-frame-wrapper">
      <iframe
        src={src}
        title={nb.title}
        className="notebook-frame"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
