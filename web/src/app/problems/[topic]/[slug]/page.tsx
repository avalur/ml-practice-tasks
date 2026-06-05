import { notFound } from "next/navigation";
import { marked } from "marked";
import { getManifest, getProblem, getStarterCode } from "@/lib/content";
import { constraintSummary } from "@/lib/problem";
import { SolveWorkspace } from "@/components/SolveWorkspace";

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

      {problem.hints.length > 0 && (
        <div className="hints">
          <h2>Hints</h2>
          {problem.hints.map((hint, i) => (
            <details key={i} className="hint-box">
              <summary>Hint {i + 1}</summary>
              <p>{hint}</p>
            </details>
          ))}
        </div>
      )}

      <h2>Your solution</h2>
      <p className="muted">
        Edit <code>{problem.entry}</code> and run the real pytest suite in your
        browser — no install required. Your code is saved locally.
      </p>
      <SolveWorkspace meta={problem} starter={starter} />
    </article>
  );
}
