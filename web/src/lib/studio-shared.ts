/* Client-safe half of src/lib/studio.ts: limits, input shapes and the starter
 * deck, shared by the Studio editors and the routes that validate them. */

export const STUDIO_LIMITS = {
  courses: 10, // per teacher
  lessons: 40, // per course
  deckBytes: 400_000, // one lesson's slides, after sanitizing
  assetBytes: 2 * 1024 * 1024, // one image
  assetsPerCourse: 25 * 1024 * 1024,
  title: 140,
  description: 2000,
  items: 60, // practice or homework entries per lesson
};

// No SVG: opened directly, an SVG is a document that can run script on this
// origin, whatever the deck's own CSP says.
export const ASSET_MIME = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;

/** A practice/homework entry as the teacher writes it — class.json's shape,
 * before `*` patterns are expanded. */
export type StudioItemInput =
  | { type: "problem" | "notebook"; id: string; title?: string }
  | { type: "link"; title: string; href: string }
  | { type: "assignment"; id: string; title: string; templateHref?: string; maxScore?: number };

export type StudioHomeworkInput = { due: string; items: StudioItemInput[] } | null;

export function starterDeck(title: string): string {
  const safe = title.replace(/[<>&]/g, "");
  return `<section>
  <h2>${safe}</h2>
  <p>Your first slide. Edit the HTML in the Studio, press Save, and the preview follows.</p>
</section>

<section>
  <h3>A slide with a list</h3>
  <ul>
    <li class="fragment">Points can appear one by one (<code>class="fragment"</code>)</li>
    <li class="fragment">Formulas use KaTeX: $f(x) = \\sigma(Wx + b)$</li>
    <li class="fragment">Link a site task: <a class="practice" href="/problems/py_basics/fizz_buzz">FizzBuzz</a></li>
  </ul>
</section>
`;
}
