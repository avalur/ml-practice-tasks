import katex from "katex";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/* A submitted .ipynb rendered as one read-only HTML page, so a teacher can skim
 * a student's notebook in a browser tab instead of downloading and running it.
 *
 * The notebook is the student's file, so everything in it is untrusted: an
 * HTML output or a markdown cell can carry <script>, event handlers, forms and
 * images from anywhere. Two layers keep it inert:
 *   - this module escapes every text it emits and passes HTML (markdown cells,
 *     text/html outputs) through an allowlist — no script/style/iframe/form/svg,
 *     no attributes that run or load anything, images only as data: URIs;
 *   - the route serves the page with `CSP: sandbox` (no allow-scripts), so the
 *     document has an opaque origin, cannot run script and never sees the
 *     site's cookies, plus default-src 'none' / img-src data:.
 * Interactive outputs (plotly, widgets) need script and are shown as their
 * text/plain fallback with a note — download the file to run them.
 *
 * Math is KaTeX rendered to MathML only, so the page needs no fonts or CSS
 * from anywhere. Rendering is a generator of chunks, one per cell: the route
 * streams them, because a Vercel function's buffered response caps at 4.5 MB
 * and a notebook full of plots easily passes that. */

export type NotebookPageInfo = {
  title: string;
  /** Lines under the title: student, submission date, kernel… (plain text). */
  meta?: string[];
  downloadHref?: string;
};

type Json = Record<string, unknown>;

/** Per-output cap on text, so one runaway print loop doesn't make a 50 MB page. */
export const MAX_OUTPUT_TEXT = 100_000;

const IMAGE_MIMES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;

export class NotebookFormatError extends Error {}

/* ---------- parsing ---------- */

export function parseNotebook(text: string): Json {
  let nb: unknown;
  try {
    nb = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    throw new NotebookFormatError("The file is not valid JSON, so it is not a Jupyter notebook.");
  }
  if (!isObj(nb)) throw new NotebookFormatError("The file is not a Jupyter notebook.");
  if (!Array.isArray(nb.cells)) {
    if (Array.isArray(nb.worksheets)) {
      throw new NotebookFormatError(
        "This notebook uses the old nbformat 3, which the viewer does not read. Download it instead.",
      );
    }
    throw new NotebookFormatError("The file has no cells, so it is not a Jupyter notebook.");
  }
  return nb;
}

/* ---------- small helpers ---------- */

function isObj(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** nbformat stores multiline strings either as one string or as a list of lines. */
export function joinText(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string").join("");
  return "";
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(s: string): { text: string; cut: number } {
  if (s.length <= MAX_OUTPUT_TEXT) return { text: s, cut: 0 };
  return { text: s.slice(0, MAX_OUTPUT_TEXT), cut: s.length - MAX_OUTPUT_TEXT };
}

function truncNote(cut: number): string {
  return cut > 0
    ? `<div class="nb-note">… ${cut.toLocaleString("en-US")} more characters not shown — download the notebook for the full output.</div>`
    : "";
}

/** A base64 image as a data: URI, or null if it isn't plausibly base64. */
export function dataUri(mime: string, payload: unknown): string | null {
  const b64 = joinText(payload).replace(/\s+/g, "");
  if (!b64 || !/^[A-Za-z0-9+/]+=*$/.test(b64)) return null;
  return `data:${mime};base64,${b64}`;
}

function svgUri(payload: unknown): string | null {
  const svg = joinText(payload);
  if (!svg.trim()) return null;
  // As an <img>, an SVG is a picture: its scripts and links never run.
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

/** Terminal progress bars (tqdm) redraw with \r — keep only the last state of each line. */
export function collapseCarriageReturns(s: string): string {
  return s
    .split("\n")
    .map((line) => {
      const parts = line.replace(/\r+$/, "").split("\r");
      return parts[parts.length - 1];
    })
    .join("\n");
}

/* ---------- ANSI colours (tracebacks, coloured prints) ---------- */

const ANSI_COLORS = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];

/** Escapes the text and turns SGR colour codes into spans; every other escape is dropped. */
export function ansiToHtml(input: string): string {
  let out = "";
  let fg: string | null = null;
  let bold = false;
  const re = /\x1b\[([0-9;]*)m|\x1b\[[0-9;?]*[A-Za-z]|\x1b[()][A-Za-z0-9]/g;
  let last = 0;
  const flushText = (t: string) => {
    if (!t) return;
    const cls = [fg ? `ansi-${fg}` : "", bold ? "ansi-bold" : ""].filter(Boolean).join(" ");
    out += cls ? `<span class="${cls}">${escapeHtml(t)}</span>` : escapeHtml(t);
  };
  for (let m = re.exec(input); m; m = re.exec(input)) {
    flushText(input.slice(last, m.index));
    last = re.lastIndex;
    if (m[1] === undefined) continue; // not a colour code
    const codes = m[1] === "" ? [0] : m[1].split(";").map(Number);
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) { fg = null; bold = false; }
      else if (c === 1) bold = true;
      else if (c === 22) bold = false;
      else if (c === 39) fg = null;
      else if (c >= 30 && c <= 37) fg = ANSI_COLORS[c - 30];
      else if (c >= 90 && c <= 97) fg = `bright-${ANSI_COLORS[c - 90]}`;
      else if (c === 38 || c === 48) i += codes[i + 1] === 5 ? 2 : 4; // 256/true colour: skip args
    }
  }
  flushText(input.slice(last));
  return out;
}

/* ---------- Python highlighting ---------- */

const PY_KEYWORDS = new Set(
  ("False None True and as assert async await break class continue def del elif else except " +
    "finally for from global if import in is lambda nonlocal not or pass raise return try while " +
    "with yield match case").split(" "),
);
const PY_BUILTINS = new Set(
  ("print len range enumerate zip map filter sum min max abs sorted reversed list dict set tuple " +
    "str int float bool type isinstance super open round any all iter next self").split(" "),
);
const PY_TOKEN =
  /(#[^\n]*)|((?:[rRbBuUfF]{0,2})(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?))|(@[A-Za-z_][\w.]*)|(\b\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?\d+)?j?\b|\b0[xXoObB][\da-fA-F_]+\b)|([A-Za-z_]\w*)/g;

/** Escaped Python source with spans for comments, strings, keywords and numbers. */
export function highlightPython(src: string): string {
  let out = "";
  let last = 0;
  for (let m = PY_TOKEN.exec(src); m; m = PY_TOKEN.exec(src)) {
    out += escapeHtml(src.slice(last, m.index));
    last = PY_TOKEN.lastIndex;
    const [tok, comment, str, deco, num, ident] = m;
    let cls = "";
    if (comment) cls = "tok-comment";
    else if (str) cls = "tok-string";
    else if (deco) cls = "tok-deco";
    else if (num) cls = "tok-number";
    else if (ident) cls = PY_KEYWORDS.has(ident) ? "tok-keyword" : PY_BUILTINS.has(ident) ? "tok-builtin" : "";
    out += cls ? `<span class="${cls}">${escapeHtml(tok)}</span>` : escapeHtml(tok);
  }
  return out + escapeHtml(src.slice(last));
}

/* ---------- math + markdown ---------- */

function renderMath(tex: string, display: boolean): string {
  return katex.renderToString(tex, {
    displayMode: display,
    output: "mathml",
    throwOnError: false,
    strict: "ignore",
    trust: false,
  });
}

// Display first; \begin{…}…\end{…} is passed to KaTeX whole, as Jupyter does.
const MATH_RE =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|(\\begin\{([a-zA-Z*]+)\}[\s\S]+?\\end\{\4\})|\\\(([\s\S]+?)\\\)|\$((?:\\\$|[^$\n])+?)\$/g;
// Fenced blocks and inline code spans are left exactly as they are.
const CODE_RE = /(^|\n)(```|~~~)[^\n]*\n[\s\S]*?(?:\n\2[^\n]*(?=\n|$)|$)|`+[^`\n]*?`+/g;

/** Lifts math out of markdown (outside code), returning the masked text and the rendered math. */
export function maskMath(md: string): { masked: string; math: string[] } {
  const math: string[] = [];
  const maskSeg = (seg: string) =>
    seg.replace(MATH_RE, (_m, dd, br, env, _envName, paren, single) => {
      const display = dd !== undefined || br !== undefined || env !== undefined;
      const tex = (dd ?? br ?? env ?? paren ?? single ?? "").trim();
      return `MLPMATH${math.push(renderMath(tex, display)) - 1}X`;
    });
  let masked = "";
  let last = 0;
  for (let m = CODE_RE.exec(md); m; m = CODE_RE.exec(md)) {
    masked += maskSeg(md.slice(last, m.index)) + m[0];
    last = CODE_RE.lastIndex;
  }
  CODE_RE.lastIndex = 0;
  masked += maskSeg(md.slice(last));
  return { masked, math };
}

function unmaskMath(html: string, math: string[]): string {
  return html.replace(/MLPMATH(\d+)X/g, (_m, i: string) => math[Number(i)] ?? "");
}

type Attachments = Record<string, Record<string, unknown>>;

/** The allowlist every piece of notebook HTML goes through. */
export function sanitizeNotebookHtml(html: string, attachments?: Attachments): string {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags.filter((t) => t !== "style"),
      "img", "del", "s", "ins", "details", "summary", "kbd", "samp", "var", "mark", "small",
      "h1", "h2", "h3", "h4", "h5", "h6",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"], // target/rel are overwritten below
      img: ["src", "alt", "title", "width", "height"],
      td: ["colspan", "rowspan", "align"],
      th: ["colspan", "rowspan", "align", "scope"],
      ol: ["start"],
      code: ["class"],
      table: ["class"],
      details: ["open"],
    },
    allowedClasses: {
      code: [/^language-[\w-]+$/],
      table: ["dataframe"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["data"] },
    allowProtocolRelative: false,
    // The <style> a pandas DataFrame ships with would otherwise come out as text.
    nonTextTags: ["style", "script", "textarea", "option", "noscript", "title"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" },
      }),
      img: (tagName, attribs) => {
        let src = attribs.src ?? "";
        if (src.startsWith("attachment:")) {
          const att = attachments?.[decodeURIComponent(src.slice("attachment:".length))];
          const mime = att && Object.keys(att).find((k) => k.startsWith("image/"));
          const payload = att && mime ? att[mime] : undefined;
          src = (mime === "image/svg+xml" ? svgUri(payload) : mime ? dataUri(mime, payload) : null) ?? "";
        }
        // Only inline picture data: anything else would be a request to some
        // host (the CSP blocks it too). Show the alt text instead of a broken icon.
        if (!/^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,/i.test(src)) {
          const alt = (attribs.alt ?? "").trim();
          return { tagName: "span", attribs: {}, text: alt ? `[image: ${alt}]` : "[image]" };
        }
        return { tagName, attribs: { ...attribs, src } };
      },
    },
  });
}

/** Markdown with math → sanitized HTML. */
export function renderMarkdown(md: string, attachments?: Attachments): string {
  const { masked, math } = maskMath(md);
  const html = marked.parse(masked, { async: false, gfm: true }) as string;
  // Math is spliced back after the sanitizer: it is KaTeX's own MathML
  // (trust: false), and the allowlist above would rightly strip <math>.
  return unmaskMath(sanitizeNotebookHtml(html, attachments), math);
}

/* ---------- outputs ---------- */

function renderStream(out: Json): string {
  const { text, cut } = truncate(collapseCarriageReturns(joinText(out.text)));
  const cls = out.name === "stderr" ? "nb-stream nb-stderr" : "nb-stream";
  return `<pre class="${cls}">${ansiToHtml(text)}</pre>${truncNote(cut)}`;
}

function renderError(out: Json): string {
  const tb = Array.isArray(out.traceback) ? out.traceback.filter((x) => typeof x === "string") : [];
  const raw = tb.length ? tb.join("\n") : `${String(out.ename ?? "Error")}: ${String(out.evalue ?? "")}`;
  const { text, cut } = truncate(raw);
  return `<pre class="nb-stream nb-error">${ansiToHtml(text)}</pre>${truncNote(cut)}`;
}

function plainText(data: Json): string {
  const { text, cut } = truncate(joinText(data["text/plain"]));
  return `<pre class="nb-plain">${ansiToHtml(text)}</pre>${truncNote(cut)}`;
}

function renderRich(out: Json): string {
  const data = isObj(out.data) ? out.data : {};
  const html = joinText(data["text/html"]);
  const interactive = /<script\b/i.test(html) || Object.keys(data).some((k) =>
    k.startsWith("application/vnd.jupyter.widget") ||
    k === "application/javascript" ||
    k.startsWith("application/vnd.plotly"));

  // A static text/html output (a DataFrame) reads best; one that needs script does not.
  if (html.trim() && !/<script\b/i.test(html)) {
    const { text, cut } = truncate(html);
    return `<div class="nb-html">${sanitizeNotebookHtml(text)}</div>${truncNote(cut)}`;
  }
  for (const mime of IMAGE_MIMES) {
    if (data[mime] !== undefined) {
      const uri = dataUri(mime, data[mime]);
      if (uri) return `<div class="nb-image"><img src="${uri}" alt="output image"></div>`;
    }
  }
  if (data["image/svg+xml"] !== undefined) {
    const uri = svgUri(data["image/svg+xml"]);
    if (uri) return `<div class="nb-image"><img src="${uri}" alt="output image"></div>`;
  }
  if (data["text/markdown"] !== undefined) {
    return `<div class="nb-markdown">${renderMarkdown(joinText(data["text/markdown"]))}</div>`;
  }
  if (data["text/latex"] !== undefined) {
    const tex = joinText(data["text/latex"]).trim().replace(/^\$\$?|\$\$?$/g, "");
    return `<div class="nb-latex">${renderMath(tex, true)}</div>`;
  }
  const note = interactive
    ? `<div class="nb-note">Interactive output (it needs JavaScript) — download the notebook to see it.</div>`
    : "";
  return data["text/plain"] !== undefined ? note + plainText(data) : note;
}

export function renderOutput(out: unknown): string {
  if (!isObj(out)) return "";
  switch (out.output_type) {
    case "stream":
      return renderStream(out);
    case "error":
      return renderError(out);
    case "execute_result":
    case "display_data":
    case "update_display_data":
      return renderRich(out);
    // nbformat 3 leftovers that sometimes survive conversion
    case "pyout":
    case "pyerr":
    default:
      return "";
  }
}

/* ---------- cells ---------- */

function promptLabel(n: unknown): string {
  return typeof n === "number" ? `[${n}]` : "[ ]";
}

export function renderCell(cell: unknown, language: string): string {
  if (!isObj(cell)) return "";
  const src = joinText(cell.source);
  const attachments = isObj(cell.attachments) ? (cell.attachments as Attachments) : undefined;

  if (cell.cell_type === "markdown") {
    if (!src.trim()) return "";
    return `<section class="nb-cell nb-md"><div class="nb-prompt"></div><div class="nb-body nb-markdown">${renderMarkdown(src, attachments)}</div></section>\n`;
  }

  if (cell.cell_type === "code") {
    const code = language === "python" ? highlightPython(src) : escapeHtml(src);
    const outputs = Array.isArray(cell.outputs) ? cell.outputs : [];
    const rendered = outputs
      .map((o) => {
        const html = renderOutput(o);
        if (!html) return "";
        const isResult = isObj(o) && o.output_type === "execute_result";
        const label = isResult ? `Out${promptLabel(o.execution_count ?? cell.execution_count)}:` : "";
        return `<div class="nb-output"><div class="nb-prompt nb-out">${label}</div><div class="nb-body">${html}</div></div>`;
      })
      .join("");
    return (
      `<section class="nb-cell nb-code">` +
      `<div class="nb-input"><div class="nb-prompt nb-in">In${promptLabel(cell.execution_count)}:</div>` +
      `<pre class="nb-source"><code>${code || "&nbsp;"}</code></pre></div>` +
      (rendered ? `<div class="nb-outputs">${rendered}</div>` : "") +
      `</section>\n`
    );
  }

  if (cell.cell_type === "raw") {
    if (!src.trim()) return "";
    return `<section class="nb-cell nb-raw"><div class="nb-prompt"></div><pre class="nb-body nb-plain">${escapeHtml(src)}</pre></section>\n`;
  }
  return "";
}

/* ---------- the page ---------- */

const STYLE = `
:root{color-scheme:light dark;--bg:#fff;--fg:#1f2328;--muted:#656d76;--line:#d0d7de;--code-bg:#f6f8fa;
--in:#305fa3;--out:#b3361b;--err-bg:#fff0f0;--note:#7a5c00;--kw:#8250df;--str:#0a3069;--com:#6e7781;
--num:#0550ae;--bi:#953800;--deco:#116329;--link:#0969da}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#8d96a0;--line:#30363d;
--code-bg:#161b22;--in:#79a8ff;--out:#ff9b85;--err-bg:#2d1517;--note:#d6b34a;--kw:#d2a8ff;--str:#a5d6ff;
--com:#8b949e;--num:#79c0ff;--bi:#ffa657;--deco:#7ee787;--link:#58a6ff}}
*{box-sizing:border-box}
html{background:var(--bg);color:var(--fg)}
body{margin:0;font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg)}
main{max-width:1040px;margin:0 auto;padding:24px 16px 64px}
header.nb-head{border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:20px;
display:flex;flex-wrap:wrap;gap:8px 16px;align-items:flex-end;justify-content:space-between}
header.nb-head h1{font-size:20px;margin:0 0 4px;word-break:break-all}
header.nb-head p{margin:0;color:var(--muted);font-size:13px}
a{color:var(--link)}
.nb-dl{font-size:13px;border:1px solid var(--line);border-radius:6px;padding:4px 10px;text-decoration:none;white-space:nowrap}
.nb-cell{margin:0 0 14px}
.nb-input,.nb-output,.nb-md,.nb-raw{display:grid;grid-template-columns:68px minmax(0,1fr);gap:8px}
.nb-prompt{font:12px/1.9 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:right;color:var(--muted);user-select:none}
.nb-in{color:var(--in)}.nb-out{color:var(--out)}
pre,code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px}
pre{margin:0;overflow-x:auto;white-space:pre}
.nb-source{background:var(--code-bg);border:1px solid var(--line);border-radius:6px;padding:8px 10px}
.nb-outputs{margin-top:4px}
.nb-output .nb-body{min-width:0;overflow-x:auto;padding:2px 0}
.nb-stream,.nb-plain{padding:4px 10px;white-space:pre-wrap;word-break:break-word}
.nb-stderr,.nb-error{background:var(--err-bg);border-radius:4px}
.nb-note{font-size:12px;color:var(--note);margin:4px 0}
.nb-image img,.nb-markdown img{max-width:100%;height:auto;background:#fff}
.nb-markdown{min-width:0;overflow-wrap:break-word}
.nb-markdown>:first-child{margin-top:0}.nb-markdown>:last-child{margin-bottom:0}
.nb-markdown pre{background:var(--code-bg);padding:8px 10px;border-radius:6px}
.nb-markdown :not(pre)>code{background:var(--code-bg);padding:1px 4px;border-radius:4px}
.nb-markdown blockquote{margin:0;padding-left:12px;border-left:3px solid var(--line);color:var(--muted)}
table{border-collapse:collapse;font-size:13px;margin:4px 0}
th,td{border:1px solid var(--line);padding:3px 8px;text-align:right}
.nb-markdown th,.nb-markdown td{text-align:left}
thead th,tbody th{background:var(--code-bg)}
math[display=block]{margin:8px 0;overflow-x:auto;overflow-y:hidden}
.katex-error{color:var(--out)}
.tok-keyword{color:var(--kw)}.tok-string{color:var(--str)}.tok-comment{color:var(--com);font-style:italic}
.tok-number{color:var(--num)}.tok-builtin{color:var(--bi)}.tok-deco{color:var(--deco)}
.ansi-bold{font-weight:700}
.ansi-black{color:#3e424d}.ansi-red{color:#e75c58}.ansi-green{color:#00a250}.ansi-yellow{color:#b8860b}
.ansi-blue{color:#208ffb}.ansi-magenta{color:#d160c4}.ansi-cyan{color:#60c6c8}.ansi-white{color:#9a9a9a}
.ansi-bright-black{color:#282c36}.ansi-bright-red{color:#b22b31}.ansi-bright-green{color:#007427}
.ansi-bright-yellow{color:#b27d12}.ansi-bright-blue{color:#0065ca}.ansi-bright-magenta{color:#a03196}
.ansi-bright-cyan{color:#258f8f}.ansi-bright-white{color:#a1a6b2}
.nb-empty{color:var(--muted)}
@media (max-width:640px){.nb-input,.nb-output,.nb-md,.nb-raw{grid-template-columns:minmax(0,1fr)}
.nb-prompt{text-align:left;line-height:1.4}.nb-md>.nb-prompt,.nb-raw>.nb-prompt{display:none}}
@media print{.nb-dl{display:none}main{max-width:none}}
`;

function pageHead(info: NotebookPageInfo): string {
  const meta = (info.meta ?? []).filter(Boolean).map(escapeHtml).join(" · ");
  const dl = info.downloadHref
    ? `<a class="nb-dl" href="${escapeHtml(info.downloadHref)}" download>Download .ipynb</a>`
    : "";
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="referrer" content="no-referrer">` +
    `<title>${escapeHtml(info.title)}</title><style>${STYLE}</style></head>` +
    `<body><main><header class="nb-head"><div><h1>${escapeHtml(info.title)}</h1>` +
    (meta ? `<p>${meta}</p>` : "") +
    `</div>${dl}</header>\n`
  );
}

const PAGE_FOOT = `</main></body></html>\n`;

function notebookLanguage(nb: Json): { language: string; kernel: string | null } {
  const md = isObj(nb.metadata) ? nb.metadata : {};
  const li = isObj(md.language_info) ? md.language_info : {};
  const ks = isObj(md.kernelspec) ? md.kernelspec : {};
  const language = String(li.name ?? ks.language ?? "python").toLowerCase();
  const kernel = typeof ks.display_name === "string" ? ks.display_name : null;
  return { language, kernel };
}

/** The whole page, chunk by chunk: the head, one chunk per cell, the foot. */
export function* renderNotebookPage(nb: Json, info: NotebookPageInfo): Generator<string> {
  const { language, kernel } = notebookLanguage(nb);
  yield pageHead({ ...info, meta: [...(info.meta ?? []), ...(kernel ? [kernel] : [])] });
  const cells = nb.cells as unknown[];
  let any = false;
  for (const cell of cells) {
    let html: string;
    try {
      html = renderCell(cell, language);
    } catch {
      html = `<section class="nb-cell"><div class="nb-note">This cell could not be displayed.</div></section>\n`;
    }
    if (html) any = true;
    yield html;
  }
  if (!any) yield `<p class="nb-empty">The notebook is empty.</p>`;
  yield PAGE_FOOT;
}

/** A page that explains why there is no notebook to show. */
export function renderNotebookErrorPage(info: NotebookPageInfo, message: string): string {
  return `${pageHead(info)}<p>${escapeHtml(message)}</p>${PAGE_FOOT}`;
}

/** Joined, for tests and small callers. */
export function renderNotebookHtml(nb: Json, info: NotebookPageInfo): string {
  return [...renderNotebookPage(nb, info)].join("");
}
