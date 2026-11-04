import sanitizeHtml from "sanitize-html";

/* The one thing standing between a teacher's slides and every student's
 * session: a studio deck is served on this origin, next to the cookies, so
 * anything that can run script there can act as whoever is looking at it.
 *
 * Allowlist, not blocklist. What survives is reveal-shaped markup — sections,
 * text, lists, tables, code, images from our own asset route, links — and
 * nothing that executes, embeds, or collects input:
 *   - no <script>, <style>, <iframe>, <object>, <form>, <input>, <svg>, <math>;
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
  let out = sanitizeHtml(html, {
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
  if (!/<section\b/i.test(out)) out = `<section>\n${out.trim()}\n</section>`;
  return out.trim() + "\n";
}

/** How many top-level slides a deck has — for the editor's status line. */
export function slideCount(html: string): number {
  return (html.match(/<section\b/gi) ?? []).length;
}
