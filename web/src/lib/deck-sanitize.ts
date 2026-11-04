import sanitizeHtml from "sanitize-html";

/* The one thing standing between a teacher's slides and every student's
 * session: a studio deck is served on this origin, next to the cookies, so
 * anything that can run script there can act as whoever is looking at it.
 *
 * Allowlist, not blocklist. What survives is reveal-shaped markup — sections,
 * text, lists, tables, code, images from our own asset route, links — and
 * nothing that executes, embeds, or collects input:
 *   - no <script>, <style>, <iframe>, <object>, <form>, <input>, <svg>, <math>
 *     — with one deliberate exception, PyScript editors (below);
 *   - no event-handler attributes, and only the reveal data-* attributes that
 *     cannot load anything (data-background-iframe/-video are out);
 *   - images only from /api/studio/assets/<id> or an inline data: image;
 *   - style attributes keep their declarations but lose every url(...) that is
 *     not one of our assets, so a background cannot phone home.
 * The present route adds a CSP on top (no inline script without its nonce,
 * img-src 'self' data:, form-action 'none'), so a gap here is not by itself
 * an exploit — but this is the layer that is meant to hold. */

const ASSET_SRC = /^\/api\/studio\/assets\/[a-z0-9]{20,32}$/;
const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i;

const REVEAL_DATA = [
  "data-background-color",
  "data-background-gradient",
  "data-background-image",
  "data-background-size",
  "data-background-position",
  "data-background-repeat",
  "data-background-opacity",
  "data-transition",
  "data-transition-speed",
  "data-auto-animate",
  "data-auto-animate-id",
  "data-fragment-index",
  "data-id",
  "data-line-numbers",
  "data-trim",
  "data-noescape",
];

/* PyScript editors: <script type="py-editor" env="…">python</script>.
 *
 * The one kind of script a studio deck may carry, and a conscious trade: the
 * Python runs on this origin in a worker, so a teacher's code could call the
 * site as the student who presses Run. Approved teachers are trusted with that
 * (the terms forbid it; an admin can suspend a course). What is still held:
 *   - it runs only on a click: `setup` (auto-run), `config`, `src` and every
 *     other attribute are dropped, and `type` is fixed — no other script type;
 *   - the code cannot end its own <script> or open an HTML comment, so it can
 *     never turn into markup;
 *   - editors are cut out before sanitize-html runs and put back only where a
 *     whole placeholder element survived, so code smuggled into an attribute
 *     value comes back as inert text, never as a tag. */
const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const PY_TYPE = /\btype\s*=\s*(["']?)py-editor\1(?=[\s/]|$)/i;
const PY_ENV = /\benv\s*=\s*(["']?)([A-Za-z0-9_-]{1,40})\1(?=[\s/]|$)/i;

function pyEditor(attrs: string, code: string): string {
  const env = PY_ENV.exec(attrs)?.[2];
  const safe = code.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
  return `<script type="py-editor"${env ? ` env="${env}"` : ""}>${safe}</script>`;
}

function cleanStyle(style: string): string {
  return style
    .replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (m, _q, url: string) =>
      ASSET_SRC.test(url.trim()) ? m : "none",
    )
    .replace(/expression\s*\(|behavior\s*:|-moz-binding|javascript:/gi, "");
}

function isSafeHref(href: string): boolean {
  const h = href.trim();
  if (h.startsWith("/") && !h.startsWith("//")) return true;
  if (h.startsWith("#")) return true;
  return /^(https?:|mailto:)/i.test(h);
}

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "section", "aside", "div", "span", "p", "br", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "dl", "dt", "dd",
    "strong", "em", "b", "i", "u", "s", "del", "ins", "mark", "small", "sup", "sub",
    "code", "pre", "kbd", "samp", "blockquote", "q", "cite",
    "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
    "details", "summary",
  ],
  allowedAttributes: {
    "*": ["class", "style", "title", "lang", "dir", ...REVEAL_DATA],
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    td: ["colspan", "rowspan", "align"],
    th: ["colspan", "rowspan", "align", "scope"],
    ol: ["start", "type"],
    col: ["span"],
  },
  // Schemes are checked in transformTags (hrefs) and by the src regexes
  // (images); sanitize-html's own scheme check is kept as a second net.
  allowedSchemes: ["http", "https", "mailto", "data"],
  allowedSchemesByTag: { img: ["data"], a: ["http", "https", "mailto"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  // Discarded tags drop their text too for these, rather than leaving their
  // script or CSS source on the slide as visible text.
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "object", "svg", "math"],
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      if (!isSafeHref(href)) {
        const { href: _drop, ...rest } = attribs;
        return { tagName, attribs: rest };
      }
      const external = /^(https?:|mailto:)/i.test(href.trim());
      return {
        tagName,
        attribs: external
          ? { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" }
          : { ...attribs, rel: attribs.rel === "noopener" ? "noopener" : "" },
      };
    },
    img: (tagName, attribs) => {
      const src = (attribs.src ?? "").trim();
      const ok = ASSET_SRC.test(src) || DATA_IMAGE.test(src);
      const next: sanitizeHtml.Attributes = ok ? { ...attribs, src } : { alt: attribs.alt ?? "" };
      return { tagName, attribs: next };
    },
  },
  exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
};

/** Sanitize a studio deck. Always returns a deck with at least one slide. */
export function sanitizeDeck(html: string): string {
  const editors: string[] = [];
  const marker = `mlp-py-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  const marked = html.replace(SCRIPT_RE, (_m, attrs: string, code: string) => {
    if (!PY_TYPE.test(attrs)) return "";
    editors.push(pyEditor(attrs, code));
    return `<pre class="${marker}-${editors.length - 1}"></pre>`;
  });
  let out = sanitizeHtml(marked, {
    ...OPTIONS,
    transformTags: {
      ...OPTIONS.transformTags,
      "*": (tagName, attribs) => {
        const next = { ...attribs };
        if (next.style) next.style = cleanStyle(next.style);
        const bg = next["data-background-image"];
        if (bg !== undefined && !ASSET_SRC.test(bg.trim())) delete next["data-background-image"];
        return { tagName, attribs: next };
      },
    },
  });
  // sanitize-html applies "*" only when no tag-specific transform exists, so
  // style on <a>/<img> needs the same pass.
  out = out.replace(/<(a|img)\b([^>]*)\sstyle="([^"]*)"/gi, (_m, tag, pre, style) =>
    `<${tag}${pre} style="${cleanStyle(style)}"`,
  );
  out = out.replace(/\srel=""/g, "");
  out = out.replace(new RegExp(`<pre class="${marker}-(\\d+)"></pre>`, "g"), (_m, i: string) => editors[Number(i)] ?? "");
  if (!/<section\b/i.test(out)) out = `<section>\n${out.trim()}\n</section>`;
  return out.trim() + "\n";
}

/** How many top-level slides a deck has — for the editor's status line. */
export function slideCount(html: string): number {
  return (html.match(/<section\b/gi) ?? []).length;
}
