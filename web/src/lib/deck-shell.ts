/* The present.html page for a studio lesson, rendered per request.
 *
 * Mirrors SHELL in export_decks.py — same reveal subset, same fixed 1280×720,
 * same annotate.js / fitslides.js — so ink, boards and "Finish lesson" behave
 * exactly as on a repo deck. Differences, all deliberate:
 *   - the only inline script carries a nonce, and the CSP below allows no other;
 *   - PyScript is loaded only when the deck has a py-editor (the sanitizer
 *     lets those through and nothing else), and only then does the CSP open
 *     up to its CDNs and to WebAssembly; no devreload.js;
 *   - the body's onload="totalWrapper()" is called from the nonced script,
 *     since an inline handler attribute is exactly what the CSP forbids. */

const SHARED = "/classes/_shared";
// Same release as PYSCRIPT in export_decks.py — keep the two in step.
const PYSCRIPT = "https://pyscript.net/releases/2024.11.1";

export function hasPython(deck: string): boolean {
  return /<script type="py-editor"/.test(deck);
}

const REVEAL_CONFIG = {
  hash: true,
  width: 1280,
  height: 720,
  margin: 0.04,
  minScale: 0.2,
  maxScale: 2.0,
  center: true,
  katex: { local: `${SHARED}/katex` },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function deckCsp(nonce: string, python = false): string {
  // PyScript's core and editor come from pyscript.net, Pyodide and its
  // packages from jsDelivr, and running WebAssembly needs 'wasm-unsafe-eval'.
  // The editor's worker is bootstrapped from a blob: URL it fetches and runs,
  // hence blob: in both script-src and connect-src; and polyscript builds
  // functions with new Function, which only 'unsafe-eval' allows (a blob
  // worker inherits this policy). None of that widens what is trusted: the
  // teacher's Python reaches JavaScript through its `js` module anyway, and
  // without a script to start it markup still cannot evaluate anything.
  const py = python ? " https://pyscript.net https://cdn.jsdelivr.net" : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${python ? `${py} blob: 'unsafe-eval' 'wasm-unsafe-eval'` : ""}`,
    // reveal and KaTeX set inline styles; the theme imports Google Fonts.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com${py}`,
    `font-src 'self' data: https://fonts.gstatic.com${py}`,
    "img-src 'self' data: blob:",
    `connect-src 'self'${python ? `${py} blob:` : ""}`,
    // annotate.js hands the PDF to /classes/blob-bridge in a hidden iframe.
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'self'",
  ].join("; ");
}

export function renderDeckPage(opts: {
  classSlug: string;
  classTitle: string;
  lessonSlug: string;
  lessonTitle: string;
  deck: string; // already sanitized
  deckHash: string;
  nonce: string;
  /** The Studio's live preview: always the slide view, however narrow the
   * column (reveal otherwise switches to its scroll view under 435px), every
   * fragment shown, and no transitions while the editor moves between slides. */
  preview?: boolean;
}): string {
  const { nonce } = opts;
  const config = opts.preview
    ? { ...REVEAL_CONFIG, scrollActivationWidth: null, fragments: false, transition: "none", backgroundTransition: "none" }
    : REVEAL_CONFIG;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, minimal-ui">
<meta name="robots" content="noindex">
<title>${esc(opts.lessonTitle)} — ${esc(opts.classTitle)}</title>
<link rel="stylesheet" href="${SHARED}/reset.css">
<link rel="stylesheet" href="${SHARED}/reveal.css">
<link rel="stylesheet" href="${SHARED}/theme/sky.css">
<link rel="stylesheet" href="${SHARED}/plugin/highlight/monokai.css">
<link rel="stylesheet" href="${SHARED}/present.css">
${hasPython(opts.deck) ? `<link rel="stylesheet" href="${PYSCRIPT}/core.css">\n<script type="module" src="${PYSCRIPT}/core.js"></script>\n` : ""}</head>
<body data-class="${esc(opts.classSlug)}" data-lesson="${esc(opts.lessonSlug)}" data-deck-hash="${esc(opts.deckHash)}" data-studio="1">
<div class="reveal">
<div class="slides">
${opts.deck}
</div>
</div>
<script src="${SHARED}/reveal.js"></script>
<script src="${SHARED}/plugin/notes/notes.js"></script>
<script src="${SHARED}/plugin/highlight/highlight.js"></script>
<script src="${SHARED}/plugin/math/math.js"></script>
<script src="${SHARED}/utils.js"></script>
<script src="${SHARED}/vendor/html2canvas.min.js"></script>
<script src="${SHARED}/vendor/jspdf.umd.min.js"></script>
<script nonce="${nonce}">
Reveal.initialize(Object.assign(${JSON.stringify(config)}, {
  plugins: [RevealHighlight, RevealNotes, RevealMath.KaTeX]
}));
window.addEventListener('load', function () {
  if (typeof totalWrapper === 'function') totalWrapper();
});
</script>
<script src="${SHARED}/fitslides.js"></script>
<script src="${SHARED}/annotate.js"></script>
</body>
</html>
`;
}
