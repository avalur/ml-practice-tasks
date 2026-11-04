/* A task proposal, in the shapes both the Studio form and the routes use, plus
 * the two transformations content_pipeline.py applies to a real problem —
 * so the in-browser check exercises the same stub a student would get. */

export const SOLUTION_BEGIN = "# --- solution: begin ---";
export const SOLUTION_END = "# --- solution: end ---";
const STUB = 'raise NotImplementedError("Your code here")';

export const PROPOSAL_LIMITS = { code: 40_000, statement: 8_000 };

export type Banned = {
  modules?: string[];
  names?: string[];
  loops?: boolean;
  operators?: string[];
  slicing?: boolean;
};

export type ProposalInput = {
  topic: string;
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  entry: string;
  statement: string;
  reference: string;
  test: string;
  banned: Banned;
  pyDeps: string[];
};

export type ProposalCheck = { referencePassed: number; referenceTotal: number; stubFailed: boolean; at: string };

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SLUG = /^[a-z][a-z0-9_]*$/;

export function validateProposal(p: Partial<ProposalInput>): string[] {
  const e: string[] = [];
  if (!p.topic || !SLUG.test(p.topic) || !p.topic.includes("_")) {
    e.push("topic must look like family_topic, e.g. numpy_basics or py_strings");
  }
  if (!p.slug || !SLUG.test(p.slug)) e.push("slug must be lowercase letters, digits and _");
  if (!p.title?.trim() || p.title.length > 120) e.push("a title is needed (up to 120 characters)");
  if (!["easy", "medium", "hard"].includes(p.difficulty ?? "")) e.push("difficulty is easy, medium or hard");
  if (!p.entry || !IDENT.test(p.entry)) e.push("entry must be the function name students implement");
  if (!p.statement?.trim()) e.push("a statement is needed");
  if ((p.statement?.length ?? 0) > PROPOSAL_LIMITS.statement) e.push("the statement is too long");
  for (const [name, src] of [["reference.py", p.reference], ["test.py", p.test]] as const) {
    if (!src?.trim()) e.push(`${name} is empty`);
    else if (src.length > PROPOSAL_LIMITS.code) e.push(`${name} is too long`);
  }
  if (p.reference && (!p.reference.includes(SOLUTION_BEGIN) || !p.reference.includes(SOLUTION_END))) {
    e.push(`reference.py must wrap the solution in "${SOLUTION_BEGIN}" / "${SOLUTION_END}"`);
  }
  if (p.reference && p.entry && !new RegExp(`def\\s+${p.entry}\\s*\\(`).test(p.reference)) {
    e.push(`reference.py has no function ${p.entry}()`);
  }
  if (p.test && !/def\s+test_/.test(p.test)) e.push("test.py has no test_ functions");
  const b = p.banned ?? {};
  for (const k of ["modules", "names", "operators"] as const) {
    if (b[k] !== undefined && (!Array.isArray(b[k]) || b[k]!.some((x) => typeof x !== "string" || !x.trim()))) {
      e.push(`banned.${k} must be a list of names`);
    }
  }
  if (b.operators?.some((o) => o !== "in" && o !== "not in")) e.push('banned.operators may only hold "in" / "not in"');
  if (!Array.isArray(p.pyDeps) || p.pyDeps.some((d) => !/^[a-z0-9_-]+$/.test(d))) e.push("py_deps must be package names");
  return e;
}

/** content_pipeline.make_stub, line for line. */
export function makeStub(reference: string): string {
  const lines = reference.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === SOLUTION_BEGIN) {
      const indent = line.slice(0, line.length - line.trimStart().length);
      out.push(`${indent}${STUB}`);
      i++;
      while (i < lines.length && lines[i].trim() !== SOLUTION_END) i++;
      continue;
    }
    out.push(line);
  }
  return out.join("\n").trimEnd() + "\n";
}

function pyString(s: string): string {
  return JSON.stringify(s); // a JSON string literal is a valid Python one
}

function pyValue(v: unknown, indent: string): string {
  if (typeof v === "string") return pyString(v);
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return `[${v.map((x) => pyValue(x, indent)).join(", ")}]`;
  if (v && typeof v === "object") {
    const entries = Object.entries(v).filter(([, x]) => x !== undefined && !(Array.isArray(x) && x.length === 0) && x !== false);
    if (entries.length === 0) return "{}";
    return `{${entries.map(([k, x]) => `${pyString(k)}: ${pyValue(x, indent)}`).join(", ")}}`;
  }
  return "None";
}

/** The meta.py a proposal becomes — the same keys a hand-written one has. */
export function metaPy(p: ProposalInput): string {
  const statement = p.statement.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"');
  return `META = {
    "title": ${pyString(p.title)},
    "topic": ${pyString(p.topic)},
    "difficulty": ${pyString(p.difficulty)},
    "entry": ${pyString(p.entry)},
    "py_deps": ${pyValue(p.pyDeps, "    ")},
    "banned": ${pyValue(p.banned, "    ")},
    "statement": """
${statement.trim()}
""",
}
`;
}
