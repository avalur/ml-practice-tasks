/* Pure helpers for bringing an existing lesson's slides into a studio deck —
 * no database, no network, so they can be unit-tested on their own. The
 * importer (deck-import.ts) does the fetching and the asset rows.
 *
 * Why this exists: a model cannot open a link. Asked to "copy the slides at
 * <url>", it writes a plausible deck of its own — different slides, different
 * style, editors that import numpy without asking for it. So the server reads
 * the lesson itself and hands the model the real slides, numbered, and the
 * model may answer with references to them instead of retyping 40 KB. */

/** A lesson deck on this site, as named by a URL in the teacher's message. */
export type DeckRef = { classSlug: string; lessonSlug: string; url: string };

const SLUG = "[a-z0-9][a-z0-9-]{0,80}";
const DECK_URL = new RegExp(
  `(?:https?://([A-Za-z0-9.-]+(?::\\d+)?))?/classes/(${SLUG})/(${SLUG})(?:/present\\.html)?(?=[\\s#?)"'.,;]|$)`,
  "g",
);

/** Lesson URLs of this site in a message. `hosts` are the host names that
 * count as "this site"; a bare path counts too. Lessons of other sites are not
 * ours to read, and never fetched. */
export function findDeckRefs(text: string, hosts: string[]): DeckRef[] {
  const own = new Set(hosts.map((h) => h.toLowerCase()));
  const seen = new Set<string>();
  const out: DeckRef[] = [];
  for (const m of text.matchAll(DECK_URL)) {
    const [url, host, classSlug, lessonSlug] = m;
    if (host && !own.has(host.toLowerCase())) continue;
    if (classSlug === "_shared" || lessonSlug === "assets") continue;
    const key = `${classSlug}/${lessonSlug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ classSlug, lessonSlug, url });
  }
  return out;
}

/** The slides and the deck's own <style> out of a published present.html. */
export function slidesOfPage(page: string): { slides: string; css: string } | null {
  const open = page.search(/<div class="slides">/i);
  const end = page.toLowerCase().lastIndexOf("</section>");
  if (open < 0 || end < open) return null;
  const head = page.slice(0, open);
  const css = [...head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const slides = page.slice(open + '<div class="slides">'.length, end + "</section>".length);
  return { slides, css };
}

/** A studio deck has no <style> (the sanitizer drops it), so a deck's own
 * class rules travel as inline styles on the elements that carry the class.
 * Only plain `.name { … }` rules can move this way; anything else (`.row::after`,
 * `h2 em`, @media) is reported so the caller can say what was left behind. */
export function inlineClassStyles(html: string, css: string): { html: string; dropped: string[] } {
  const rules = new Map<string, string>();
  const dropped: string[] = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let i = 0;
  while (i < text.length) {
    const brace = text.indexOf("{", i);
    if (brace < 0) break;
    const selector = text.slice(i, brace).trim();
    // Find the matching close, so an @media block is skipped as a whole.
    let depth = 1;
    let j = brace + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") depth--;
      j++;
    }
    const body = text.slice(brace + 1, j - 1).trim();
    i = j;
    if (!selector) continue;
    if (selector.startsWith("@")) {
      dropped.push(selector);
      continue;
    }
    for (const sel of selector.split(",").map((s) => s.trim())) {
      const m = /^\.([A-Za-z_][A-Za-z0-9_-]*)$/.exec(sel);
      if (!m) {
        dropped.push(sel);
        continue;
      }
      const decls = body.replace(/\s+/g, " ").replace(/\s*;\s*$/, "");
      if (decls) rules.set(m[1], [rules.get(m[1]), decls].filter(Boolean).join("; "));
    }
  }
  if (rules.size === 0) return { html, dropped };
  const out = html.replace(/<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (tag, name: string, attrs: string) => {
    const cls = /\sclass\s*=\s*"([^"]*)"/i.exec(attrs);
    if (!cls) return tag;
    const decls = cls[1]
      .split(/\s+/)
      .map((c) => rules.get(c))
      .filter(Boolean)
      .join("; ");
    if (!decls) return tag;
    const style = /\sstyle\s*=\s*"([^"]*)"/i.exec(attrs);
    // The element's own style comes last: it won over the class rule before.
    const next = style
      ? attrs.replace(style[0], ` style="${decls}; ${style[1]}"`)
      : `${attrs.replace(/\s*\/?$/, "")} style="${decls}"${/\/\s*$/.test(attrs) ? " /" : ""}`;
    return `<${name}${next}>`;
  });
  return { html: out, dropped: [...new Set(dropped)] };
}

/** Top-level slides of a deck, each a whole <section>…</section> (a vertical
 * stack is one of them, with its children inside). */
export function topLevelSections(deck: string): string[] {
  const out: string[] = [];
  const re = /<(\/?)section\b[^>]*>/gi;
  let depth = 0;
  let start = -1;
  for (const m of deck.matchAll(re)) {
    if (!m[1]) {
      if (depth === 0) start = m.index!;
      depth++;
    } else if (depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        out.push(deck.slice(start, m.index! + m[0].length));
        start = -1;
      }
    }
  }
  return out;
}

/** The source deck as the model sees it: every top-level slide numbered. */
export function numberedDeck(sections: string[]): string {
  return sections.map((s, i) => `<!-- slide ${i + 1} -->\n${s}`).join("\n\n");
}

/** Replace the model's references to source slides with the slides
 * themselves: `<copy-source/>` is the whole deck, `<source-slides from="3"
 * to="7"/>` a range (`to` optional). An out-of-range number is clamped, a
 * malformed tag is dropped. Returns how many references were expanded. */
export function expandSourceRefs(answer: string, sections: string[]): { text: string; refs: number } {
  let refs = 0;
  const n = sections.length;
  const REF = String.raw`<copy-source\s*\/?>(?:\s*<\/copy-source>)?|<source-slides?\b[^>]*?\/?>(?:\s*<\/source-slides?>)?`;
  // Each source slide is already a whole <section> (or a vertical stack of
  // them), so a <section> the model put around references would nest a stack
  // a level deeper than reveal can show. Drop such wrappers.
  const unwrapped = answer.replace(
    new RegExp(String.raw`<section\b[^>]*>\s*((?:(?:${REF})\s*)+)<\/section>`, "gi"),
    (_m, inner: string) => inner,
  );
  const text = unwrapped
    .replace(/<copy-source\s*\/?>(?:\s*<\/copy-source>)?/gi, () => {
      refs++;
      return "\n" + sections.join("\n\n") + "\n";
    })
    .replace(/<source-slides?\b([^>]*?)\/?>(?:\s*<\/source-slides?>)?/gi, (_m, attrs: string) => {
      const num = (name: string) => {
        const v = new RegExp(`\\b${name}\\s*=\\s*["']?(\\d+)`, "i").exec(attrs);
        return v ? Number(v[1]) : null;
      };
      const from = num("from") ?? num("n");
      if (from === null || n === 0) return "";
      const to = num("to") ?? from;
      const a = Math.min(Math.max(1, from), n);
      const b = Math.min(Math.max(a, to), n);
      refs++;
      return "\n" + sections.slice(a - 1, b).join("\n\n") + "\n";
    });
  return { text, refs };
}

/** What a pyscript.toml asks for, read with just enough TOML for the decks we
 * publish: `packages = [...]` and a `[files]` table of `"name" = "…"`. */
export function readPyToml(toml: string): { packages: string[]; files: { src: string; dest: string }[] } {
  const packages: string[] = [];
  const files: { src: string; dest: string }[] = [];
  let table = "";
  for (const raw of toml.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const t = /^\[([^\]]+)\]$/.exec(line);
    if (t) {
      table = t[1].trim();
      continue;
    }
    const kv = /^(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_.-]+))\s*=\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = (kv[1] ?? kv[2] ?? kv[3]).trim();
    const rest = kv[4];
    if (table === "" && key === "packages") {
      for (const p of rest.matchAll(/["']([^"']+)["']/g)) packages.push(p[1]);
    } else if (table === "files") {
      // The key is where the file is fetched from (relative to the toml), the
      // value where it lands in the interpreter; "" keeps the key's name.
      const value = /^["']([^"']*)["']/.exec(rest)?.[1] ?? "";
      const base = (p: string) => p.split("/").filter(Boolean).pop() ?? "";
      files.push({ src: key, dest: value && !value.endsWith("/") ? base(value) : base(key) });
    }
  }
  return { packages, files };
}
