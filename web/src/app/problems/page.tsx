import { getManifest } from "@/lib/content";
import { ProblemBrowser } from "@/components/ProblemBrowser";

export const metadata = { title: "Problems — ML Practice" };

export default async function ProblemsPage() {
  const manifest = await getManifest();
  return (
    <section>
      <h1>Problems</h1>
      <ProblemBrowser manifest={manifest} />
    </section>
  );
}
