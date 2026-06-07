import { getManifest } from "@/lib/content";
import { visibleProblems } from "@/lib/problem";
import { ProblemsSidebar } from "@/components/ProblemsSidebar";

export default async function ProblemsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const manifest = await getManifest();
  const items = visibleProblems(manifest).map((p) => ({
    id: p.id,
    topic: p.topic,
    slug: p.slug,
    title: p.title,
  }));
  return (
    <div className="problems-shell">
      <ProblemsSidebar items={items} />
      <div className="problems-main">{children}</div>
    </div>
  );
}
