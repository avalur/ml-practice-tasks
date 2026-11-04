"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";

import { useTheme } from "@/components/ThemeProvider";
import { SHARED, type RunResult } from "@/lib/runner";
import {
  SOLUTION_BEGIN,
  SOLUTION_END,
  makeStub,
  metaPy,
  validateProposal,
  type ProposalCheck,
  type ProposalInput,
} from "@/lib/proposal-shared";

const REFERENCE_TEMPLATE = `def my_function(xs: list[int]) -> int:
    """
    Explain the task here: this docstring is kept in the student's stub.
    """
    ${SOLUTION_BEGIN}
    total = 0
    for x in xs:
        total += x
    return total
    ${SOLUTION_END}
`;

const TEST_TEMPLATE = `import random

import pytest

from tools.checks import assert_clean


def oracle(xs):
    return sum(xs)


@pytest.mark.parametrize("seed", range(5))
def test_random(impl, seed):
    rng = random.Random(seed)
    xs = [rng.randint(-100, 100) for _ in range(rng.randint(0, 50))]
    assert impl.my_function(xs) == oracle(xs)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
`;

const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/** Run one pytest suite in a fresh Pyodide worker and resolve with its result.
 * Its own worker rather than the shared hook: the check is two runs in a row
 * (reference, then stub), and a promise per run keeps that sequential. */
function runSuite(files: Record<string, string>, testPath: string, pyDeps: string[]): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const w = new Worker("/pyodide-worker.js");
    const timer = setTimeout(() => {
      w.terminate();
      reject(new Error("The tests took longer than 60 s."));
    }, 60_000);
    w.onmessage = (e: MessageEvent) => {
      const msg = e.data || {};
      if (msg.type === "RESULT") {
        clearTimeout(timer);
        w.terminate();
        resolve(msg.result as RunResult);
      } else if (msg.type === "ERROR") {
        clearTimeout(timer);
        w.terminate();
        reject(new Error(msg.error || "runner error"));
      }
    };
    w.postMessage({ type: "RUN", runId: 1, files, testPath, pyDeps });
  });
}

/* Propose a task: the same three files a hand-written problem has, with a
 * check that runs them here, in the browser, exactly as a student's run
 * would — the reference must pass every test, and the stub students get must
 * fail at least one (otherwise the tests check nothing). */
export function ProposalEditor() {
  const router = useRouter();
  const { theme } = useTheme();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [slug, setSlug] = useState("");
  const [difficulty, setDifficulty] = useState<ProposalInput["difficulty"]>("easy");
  const [entry, setEntry] = useState("my_function");
  const [statement, setStatement] = useState("");
  const [reference, setReference] = useState(REFERENCE_TEMPLATE);
  const [test, setTest] = useState(TEST_TEMPLATE);
  const [bannedNames, setBannedNames] = useState("sum");
  const [bannedModules, setBannedModules] = useState("");
  const [noLoops, setNoLoops] = useState(false);
  const [numpy, setNumpy] = useState(false);
  const [check, setCheck] = useState<ProposalCheck | null>(null);
  const [checkText, setCheckText] = useState<string | null>(null);
  const [busy, setBusy] = useState<"check" | "send" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const checkedFor = useRef<string>("");

  const proposal = (): ProposalInput => ({
    title,
    topic,
    slug,
    difficulty,
    entry,
    statement,
    reference,
    test,
    banned: {
      ...(list(bannedModules).length ? { modules: list(bannedModules) } : {}),
      ...(list(bannedNames).length ? { names: list(bannedNames) } : {}),
      ...(noLoops ? { loops: true } : {}),
    },
    pyDeps: numpy ? ["numpy"] : [],
  });
  const fingerprint = () => JSON.stringify(proposal());

  async function runCheck() {
    const p = proposal();
    const errors = validateProposal(p);
    if (errors.length) {
      setErr(errors.join("\n"));
      return;
    }
    setErr(null);
    setBusy("check");
    setCheck(null);
    setCheckText("Loading Python in the browser (the first time takes a while)…");
    try {
      const shared: Record<string, string> = {};
      await Promise.all(
        SHARED.map(async ([url, dest]) => {
          shared[dest] = await (await fetch(url)).text();
        }),
      );
      const dir = `problems/${p.topic}/${p.slug}`;
      const files = (submission: string) => ({
        ...shared,
        [`${dir}/test.py`]: p.test,
        [`${dir}/meta.py`]: metaPy(p),
        [`${dir}/submission.py`]: submission,
      });
      const ref = await runSuite(files(p.reference), `${dir}/test.py`, p.pyDeps);
      setCheckText("Reference checked; now the student stub…");
      const stub = await runSuite(files(makeStub(p.reference)), `${dir}/test.py`, p.pyDeps);
      const result: ProposalCheck = {
        referencePassed: ref.passed,
        referenceTotal: ref.total,
        stubFailed: stub.passed < stub.total,
        at: new Date().toISOString(),
      };
      setCheck(result);
      checkedFor.current = fingerprint();
      const failing = ref.tests.filter((t) => t.outcome !== "passed");
      setCheckText(
        `Reference: ${ref.passed}/${ref.total} tests pass. Stub: ${result.stubFailed ? "fails, as it should" : "passes — the tests do not check the solution"}.` +
          (failing.length ? `\n\n${failing.map((t) => `${t.name}: ${t.detail}`).join("\n\n").slice(0, 3000)}` : "") +
          (ref.total === 0 ? `\n\n${ref.output.slice(0, 3000)}` : ""),
      );
    } catch (e) {
      setCheckText(`The check could not run: ${(e as Error).message}`);
    }
    setBusy(null);
  }

  const good =
    check !== null &&
    check.referenceTotal > 0 &&
    check.referencePassed === check.referenceTotal &&
    check.stubFailed &&
    checkedFor.current === fingerprint();

  async function send() {
    setBusy("send");
    setErr(null);
    try {
      const res = await fetch("/api/studio/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...proposal(), check }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErr(data.error ?? "Could not send.");
      else router.refresh();
    } catch {
      setErr("Network error — try again.");
    }
    setBusy(null);
  }

  return (
    <form className="teach-form studio-proposal" onSubmit={(e) => e.preventDefault()} data-testid="proposal-form">
      <div className="studio-row">
        <label>
          Title <input value={title} onChange={(e) => setTitle(e.target.value)} name="title" />
        </label>
        <label>
          Topic <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="py_basics" name="topic" />
        </label>
        <label>
          Slug <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="running_sum" name="slug" />
        </label>
        <label>
          Difficulty
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as ProposalInput["difficulty"])}>
            <option>easy</option>
            <option>medium</option>
            <option>hard</option>
          </select>
        </label>
        <label>
          Function <input value={entry} onChange={(e) => setEntry(e.target.value)} name="entry" />
        </label>
      </div>
      <label>
        Statement (Markdown, what students read)
        <textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={5} name="statement" />
      </label>
      <label>
        reference.py — your solution between the two marker comments; everything else becomes the student&rsquo;s stub
        <CodeMirror value={reference} height="260px" theme={theme} extensions={[python()]} onChange={setReference} className="editor-cm" />
      </label>
      <label>
        test.py — pytest, using the <code>impl</code>, <code>impl_source</code> and <code>banned</code> fixtures
        <CodeMirror value={test} height="300px" theme={theme} extensions={[python()]} onChange={setTest} className="editor-cm" />
      </label>
      <div className="studio-row">
        <label>
          Banned names <input value={bannedNames} onChange={(e) => setBannedNames(e.target.value)} placeholder="sum, sorted" />
        </label>
        <label>
          Banned modules <input value={bannedModules} onChange={(e) => setBannedModules(e.target.value)} placeholder="numpy, itertools" />
        </label>
        <label className="studio-inline">
          <input type="checkbox" checked={noLoops} onChange={(e) => setNoLoops(e.target.checked)} /> no loops
        </label>
        <label className="studio-inline">
          <input type="checkbox" checked={numpy} onChange={(e) => setNumpy(e.target.checked)} /> needs numpy
        </label>
      </div>
      <div className="report-actions">
        <button type="button" className="bt-clear-btn" onClick={runCheck} disabled={busy !== null} data-testid="proposal-check">
          {busy === "check" ? "Checking…" : "Check in the browser"}
        </button>
        <button type="button" className="class-present-btn" onClick={send} disabled={busy !== null || !good} data-testid="proposal-send">
          {busy === "send" ? "Sending…" : "Propose this task"}
        </button>
        {!good && <span className="muted">Run the check first — it has to pass before you can send.</span>}
      </div>
      {checkText && (
        <pre className={`studio-check ${good ? "ok" : ""}`} data-testid="proposal-check-result">
          {checkText}
        </pre>
      )}
      {err && <p className="class-join-err" style={{ whiteSpace: "pre-wrap" }}>{err}</p>}
    </form>
  );
}
