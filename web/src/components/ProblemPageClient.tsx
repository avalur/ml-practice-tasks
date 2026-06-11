"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProblemMeta } from "@/lib/problem";
import { SolveWorkspace } from "@/components/SolveWorkspace";

export function ProblemPageClient({
  problem,
  starter,
  prereqProblems,
  nextProblems,
}: {
  problem: ProblemMeta;
  starter: string;
  prereqProblems: ProblemMeta[];
  nextProblems: ProblemMeta[];
}) {
  const [solved, setSolved] = useState(false);

  return (
    <>
      <SolveWorkspace
        meta={problem}
        starter={starter}
        onSolve={() => setSolved(true)}
        nextTasks={solved ? nextProblems : []}
      />

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

      {prereqProblems.length > 0 && (
        <div className="prereqs">
          <h2>Stuck? Try these first</h2>
          {prereqProblems.map((p) => (
            <Link key={p.id} href={`/problems/${p.topic}/${p.slug}`} className="prereq-card">
              <span className={`badge ${p.difficulty}`}>{p.difficulty}</span>
              {p.title}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
