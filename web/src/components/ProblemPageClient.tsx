"use client";

import { useState } from "react";
import type { ProblemMeta } from "@/lib/problem";
import { SolveWorkspace } from "@/components/SolveWorkspace";

export function ProblemPageClient({
  problem,
  starter,
}: {
  problem: ProblemMeta;
  starter: string;
}) {
  const [solved, setSolved] = useState(false);

  return (
    <>
      <SolveWorkspace
        meta={problem}
        starter={starter}
        onSolve={() => setSolved(true)}
      />

      {!solved && problem.hints.length > 0 && (
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
    </>
  );
}
