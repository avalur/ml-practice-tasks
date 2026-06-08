import { getManifest } from "@/lib/content";
import { visibleProblems } from "@/lib/problem";
import { ProblemsSidebar } from "@/components/ProblemsSidebar";
import { ProblemsShell } from "@/components/ProblemsShell";

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
    <ProblemsShell sidebar={<ProblemsSidebar items={items} />}>
      {children}
    </ProblemsShell>
  );
}
