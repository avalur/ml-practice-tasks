"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  constraintSummary,
  type Difficulty,
  type Manifest,
} from "@/lib/problem";

export function ProblemBrowser({ manifest }: { manifest: Manifest }) {
  const [topic, setTopic] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<string>("all");

  const problems = useMemo(
    () =>
      manifest.problems.filter(
        (p) =>
          (topic === "all" || p.topic === topic) &&
          (difficulty === "all" || p.difficulty === difficulty),
      ),
    [manifest, topic, difficulty],
  );

  return (
    <>
      <div className="filters">
        <label>
          Topic
          <select value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="all">All topics</option>
            {manifest.topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Difficulty
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option value="all">All difficulties</option>
            {manifest.difficulties.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      {problems.length === 0 ? (
        <p className="empty">No problems match these filters.</p>
      ) : (
        <ul className="problem-list">
          {problems.map((p) => {
            const constraints = constraintSummary(p.banned);
            return (
              <li key={p.id}>
                <Link
                  className="problem-card"
                  href={`/problems/${p.topic}/${p.slug}`}
                >
                  <span className="title">{p.title}</span>
                  <span className="meta">
                    {constraints.length > 0 && (
                      <span className="topic-tag">{constraints.join(" · ")}</span>
                    )}
                    <span className="topic-tag">{p.topic}</span>
                    <DifficultyBadge difficulty={p.difficulty} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <span className={`badge ${difficulty}`}>{difficulty}</span>;
}
