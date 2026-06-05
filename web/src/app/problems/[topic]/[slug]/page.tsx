import { notFound } from "next/navigation";
import { marked } from "marked";
import { getManifest, getProblem, getStarterCode } from "@/lib/content";
import { constraintSummary } from "@/lib/problem";

type Params = { topic: string; slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const manifest = await getManifest();
  return manifest.problems.map((p) => ({ topic: p.topic, slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { topic, slug } = await params;
  const problem = await getProblem(topic, slug);
  return { title: problem ? `${problem.title} — ML Practice` : "Problem" };
}

export default async function ProblemPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { topic, slug } = await params;
  const problem = await getProblem(topic, slug);
  if (!problem) notFound();

  const [starter, statementHtml] = await Promise.all([
    getStarterCode(topic, slug),
    marked.parse(problem.statementMd),
  ]);
  const constraints = constraintSummary(problem.banned);

  return (
    <article>
      <div className="problem-head">
        <h1 style={{ margin: 0 }}>{problem.title}</h1>
        <span className={`badge ${problem.difficulty}`}>
          {problem.difficulty}
        </span>
        <span className="topic-tag">{problem.topic}</span>
      </div>

      <div
        className="statement"
        dangerouslySetInnerHTML={{ __html: statementHtml }}
      />

      {constraints.length > 0 && (
        <div className="constraints">
          <strong>Constraints</strong>
          <ul>
            {constraints.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <h2>Starter code</h2>
      <pre className="code">{starter}</pre>

      <div className="placeholder">
        ✏️ Interactive editor and in-browser tests land in the next step. For now
        this is read-only; soon you’ll edit <code>{problem.entry}</code> here and
        run the real pytest suite via Pyodide — no install required.
      </div>
    </article>
  );
}
