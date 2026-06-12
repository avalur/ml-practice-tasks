import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { getManifest, getProblem, getStarterCode } from "@/lib/content";
import { constraintSummary, visibleProblems } from "@/lib/problem";
import { ProblemPageClient } from "@/components/ProblemPageClient";
import { FavoriteButton } from "@/components/FavoriteButton";

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

  // Linear prev/next in catalog order (visible problems only — a hidden task
  // viewed directly gets no neighbours).
  const manifest = await getManifest();
  const byId = Object.fromEntries(manifest.problems.map((p) => [p.id, p]));
  const prereqProblems = problem.prereqs.map((id) => byId[id]).filter(Boolean);
  const nextProblems = problem.next.map((id) => byId[id]).filter(Boolean);

  const order = visibleProblems(manifest);
  const idx = order.findIndex((p) => p.topic === topic && p.slug === slug);
  const prev = idx > 0 ? order[idx - 1] : null;
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;

  return (
    <article>
      <div className="problem-head">
        <h1 style={{ margin: 0 }}>{problem.title}</h1>
        <span className={`badge ${problem.difficulty}`}>
          {problem.difficulty}
        </span>
        <span className="topic-tag">{problem.topic}</span>
        <FavoriteButton problemId={problem.id} />
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

      <h2>Your solution</h2>
      <p className="muted">
        Edit <code>{problem.entry}</code> and run the real pytest suite in your
        browser — no install required. Your code is saved locally.
      </p>
      <ProblemPageClient
        problem={problem}
        starter={starter}
        prereqProblems={prereqProblems}
        nextProblems={nextProblems}
      />

      <nav className="prevnext">
        {prev ? (
          <Link href={`/problems/${prev.topic}/${prev.slug}`}>← {prev.title}</Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/problems/${next.topic}/${next.slug}`}>{next.title} →</Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
