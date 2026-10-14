import { Marked, type TokenizerAndRendererExtension, type Tokens } from "marked";
import katex from "katex";

/** Escape characters that have special meaning in HTML attributes or text. */
export function escapeAttr(val: string): string {
  if (!val) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderKatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode,
      throwOnError: false,
    });
  } catch {
    return escapeAttr(tex);
  }
}

/** Sanitize URL for href and src attributes.
 * Normalized and percent-encoded by WHATWG URL standard, attribute-escaped.
 * Rejects javascript:, data:, vbscript:, protocol-relative URLs, and control characters.
 */
export function sanitizeUrl(href: string): string | null {
  if (!href || typeof href !== "string") return null;

  // Decode HTML entities if any (e.g. &#106;avascript: or &#x6a;avascript:)
  let decoded = href
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);?/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Remove control characters and whitespace for protocol inspection
  decoded = decoded.replace(/[\x00-\x1f\x7f\s]/g, "").toLowerCase();

  // Explicit ban on dangerous pseudo-protocols
  if (
    decoded.startsWith("javascript:") ||
    decoded.startsWith("data:") ||
    decoded.startsWith("vbscript:")
  ) {
    return null;
  }

  // Protocol-relative URLs (`//evil.com`) are off-site, not same-origin paths.
  if (href.startsWith("//")) return null;

  // Same-origin paths and in-page fragments
  if (
    href.startsWith("/") ||
    href.startsWith("./") ||
    href.startsWith("../") ||
    href.startsWith("#")
  ) {
    if (/[\x00-\x1f\x7f]/.test(href)) return null;
    return escapeAttr(href);
  }

  // Parse absolute URL and verify safe protocols
  try {
    const parsed = new URL(href);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === "http:" || protocol === "https:" || protocol === "mailto:") {
      // WHATWG URL parser normalizes and percent-encodes quotes and control chars (%22, etc.)
      return escapeAttr(parsed.href);
    }
  } catch {
    return null;
  }

  return null;
}

/** Check if a URL is safe to use in an href or src attribute.
 * Strictly prevents javascript:, data:, vbscript:, and encoded variations.
 */
export function isSafeHref(href: string): boolean {
  return sanitizeUrl(href) !== null;
}

/** Math is a marked tokenizer so KaTeX HTML is emitted only as text-level
 * tokens — never spliced into already-rendered href/src/title/alt attributes.
 * Code spans, fences and indented blocks are tokenized by marked first at
 * their own boundaries, so `$HOME` inside them stays literal.
 */
const mathExtensions: TokenizerAndRendererExtension[] = [
  {
    name: "blockMath",
    level: "block",
    start(src: string) {
      return src.startsWith("$$") ? 0 : undefined;
    },
    tokenizer(src: string) {
      const match = /^\$\$([\s\S]+?)\$\$/.exec(src);
      if (!match) return undefined;
      return {
        type: "blockMath",
        raw: match[0],
        text: match[1],
      };
    },
    renderer(token: Tokens.Generic) {
      return renderKatex(String(token.text ?? ""), true);
    },
  },
  {
    name: "inlineMath",
    level: "inline",
    start(src: string) {
      const i = src.indexOf("$");
      return i === -1 ? undefined : i;
    },
    tokenizer(src: string) {
      if (src.startsWith("$$")) {
        const block = /^\$\$([\s\S]+?)\$\$/.exec(src);
        if (!block) return undefined;
        return {
          type: "inlineMath",
          raw: block[0],
          text: block[1],
          displayMode: true,
        };
      }
      const match = /^\$([^$\n]+?)\$/.exec(src);
      if (!match) return undefined;
      return {
        type: "inlineMath",
        raw: match[0],
        text: match[1],
        displayMode: false,
      };
    },
    renderer(token: Tokens.Generic) {
      return renderKatex(String(token.text ?? ""), Boolean(token.displayMode));
    },
  },
];

/** Configured Marked instance with secure renderer disarming raw HTML and dangerous URLs. */
const safeMarked = new Marked({
  async: false,
  gfm: true,
  breaks: true,
});

safeMarked.use({
  extensions: mathExtensions,
  renderer: {
    html({ text }) {
      // Disarm raw HTML tags (e.g. <script>, <iframe onerror=>) into harmless escaped text
      return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const safe = sanitizeUrl(href);
      if (!safe) {
        // Disarm unsafe href: render only text without clickable anchor
        return text;
      }
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
      return `<a href="${safe}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
    image({ href, title, text }) {
      const safe = sanitizeUrl(href);
      if (!safe) {
        return escapeAttr(text || "");
      }
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
      const altAttr = text ? ` alt="${escapeAttr(text)}"` : "";
      return `<img src="${safe}"${altAttr}${titleAttr} />`;
    },
  },
});

/** Render markdown feedback to sanitized HTML with LaTeX math support.
 * Server-safe and client-safe; can be reused across teacher review and student profile.
 */
export function renderFeedbackMarkdown(mdText: string): string {
  if (!mdText || typeof mdText !== "string") return "";
  return safeMarked.parse(mdText) as string;
}
