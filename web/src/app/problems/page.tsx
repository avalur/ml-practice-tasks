import { getManifest } from "@/lib/content";
import { visibleProblems } from "@/lib/problem";
import { ProblemBrowser } from "@/components/ProblemBrowser";

export const metadata = { title: "Problems — ML Practice" };

export default async function ProblemsPage() {
  const manifest = await getManifest();
  // Hide unlisted problems (and their topics) from the catalog + filters.
  const problems = visibleProblems(manifest);
  const visible = {
    ...manifest,
    problems,
    topics: [...new Set(problems.map((p) => p.topic))].sort(),
  };
  return (
    <section>
      <h1>Problems</h1>
      <ProblemBrowser manifest={visible} />
    </section>
  );
}
