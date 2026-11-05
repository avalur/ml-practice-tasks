import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  expandSourceRefs,
  findDeckRefs,
  inlineClassStyles,
  readPyToml,
  slidesOfPage,
  topLevelSections,
} from "../src/lib/deck-convert.ts";
import { pyConfig, sanitizeDeck } from "../src/lib/deck-sanitize.ts";

/* Copying an existing lesson into a studio deck: the model cannot open links,
 * so the server reads the lesson and these turn it into studio markup. */

const HOSTS = ["www.mlpractice.com", "mlpractice.com", "localhost:3100"];

test("finds this site's lesson links and ignores everyone else's", () => {
  const refs = findDeckRefs(
    "copy https://www.mlpractice.com/classes/ml-intensive-tlf/l02-numpy-pandas/present.html, " +
      "and also /classes/ml-intensive-tlf/l02-numpy-pandas again, " +
      "not https://evil.example/classes/a/b/present.html nor /classes/x/assets/y.png " +
      "but http://localhost:3100/classes/c-1/l-2.",
    HOSTS,
  );
  assert.deepEqual(
    refs.map((r) => `${r.classSlug}/${r.lessonSlug}`),
    ["ml-intensive-tlf/l02-numpy-pandas", "c-1/l-2"],
  );
});

test("a deck's own class rules move inline; the rest is reported", () => {
  const css = `.column { float: left; width: 48%; }
/* comment */ .row::after { content: ""; }
.important { color: orange; } @media (max-width: 9px) { .column { width: 100%; } }`;
  const { html, dropped } = inlineClassStyles(
    `<div class="column x">a</div><span class="important" style="font-weight: bold">b</span><p class="none">c</p><img class="column" src="q.png" />`,
    css,
  );
  assert.match(html, /<div class="column x" style="float: left; width: 48%">a<\/div>/);
  assert.match(html, /<span class="important" style="color: orange; font-weight: bold">/);
  assert.match(html, /<p class="none">c<\/p>/);
  assert.match(html, /<img class="column" src="q.png" style="float: left; width: 48%" \/>/);
  assert.deepEqual(dropped, [".row::after", "@media (max-width: 9px)"]);
});

test("top-level slides keep their vertical stacks whole", () => {
  const deck = `<section><section>a</section><section>b</section></section>\n<section>c</section>`;
  assert.deepEqual(topLevelSections(deck), ["<section><section>a</section><section>b</section></section>", "<section>c</section>"]);
});

test("references to source slides expand to the exact slides", () => {
  const src = ["<section>1</section>", "<section>2</section>", "<section>3</section>"];
  assert.equal(expandSourceRefs("<copy-source/>", src).text.trim(), src.join("\n\n"));
  const { text, refs } = expandSourceRefs(
    `<section>new</section><source-slides from="2" to="9"/><source-slide n="1"></source-slide><source-slides to="2"/>`,
    src,
  );
  assert.equal(refs, 2);
  assert.equal(text.replace(/\s+/g, ""), "<section>new</section><section>2</section><section>3</section><section>1</section>");
});

test("a <section> wrapped around references is dropped, so stacks stay two levels deep", () => {
  const src = ["<section><section>a</section><section>b</section></section>", "<section>c</section>"];
  const { text } = expandSourceRefs(
    `<section>\n  <source-slides from="1" to="1"/>\n</section>\n<section data-x="1"><copy-source/></section><section><h3>Own</h3><source-slides n="2"/></section>`,
    src,
  );
  assert.equal(
    text.replace(/\s+/g, ""),
    "<section><section>a</section><section>b</section></section>" +
      "<section><section>a</section><section>b</section></section><section>c</section>" +
      // A section with content of its own is the model's slide: left alone.
      "<section><h3>Own</h3><section>c</section></section>",
  );
  assert.equal(topLevelSections(text).length, 4);
});

test("pyscript.toml: packages and the files beside it", () => {
  const cfg = readPyToml(`name = "Numpy and Pandas"\npackages = ["numpy", "pandas"]\n\n[files]\n# comment\n"example.csv" = ""\n"data/t.csv" = "./titanic.csv"\n`);
  assert.deepEqual(cfg.packages, ["numpy", "pandas"]);
  assert.deepEqual(cfg.files, [
    { src: "example.csv", dest: "example.csv" },
    { src: "data/t.csv", dest: "titanic.csv" },
  ]);
});

const ASSET = "/api/studio/assets/clh3x9k2a0000qwerty123456";

test("editor config survives only as allowed packages and our own assets", () => {
  assert.equal(pyConfig(`config='{"packages":["numpy","pandas"]}'`), '{"packages":["numpy","pandas"]}');
  assert.equal(
    pyConfig(`config="{&quot;packages&quot;:[&quot;numpy&quot;,&quot;evil-pkg&quot;],&quot;files&quot;:{&quot;${ASSET}&quot;:&quot;t.csv&quot;,&quot;https://x.example/a&quot;:&quot;a.csv&quot;,&quot;${ASSET}&quot;:&quot;../etc&quot;}}"`),
    '{"packages":["numpy"]}',
  );
  assert.equal(
    pyConfig(`config='{"files":{"${ASSET}":"titanic.csv"},"interpreter":"https://x.example/py.js","js_modules":{"main":{"https://x.example/m.js":"m"}}}'`),
    `{"files":{"${ASSET}":"titanic.csv"}}`,
  );
  assert.equal(pyConfig(`config="/classes/a/assets/pyscript.toml"`), null);
  assert.equal(pyConfig(`config='{"packages":["micropip"]}'`), null);
});

test("only the first editor of an env keeps its config", () => {
  const out = sanitizeDeck(
    `<section><script type="py-editor" env="a" config='{"packages":["numpy"]}'>import numpy</script>` +
      `<script type="py-editor" env="a" config='{"packages":["pandas"]}'>x</script>` +
      `<script type="py-editor" env="b" config='{"packages":["pandas"]}' setup>y</script></section>`,
  );
  const tags = out.match(/<script[^>]*>/g);
  assert.deepEqual(tags, [
    `<script type="py-editor" env="a" config='{"packages":["numpy"]}'>`,
    `<script type="py-editor" env="a">`,
    `<script type="py-editor" env="b" config='{"packages":["pandas"]}'>`,
  ]);
  assert.equal(sanitizeDeck(out), out, "sanitizing twice changes nothing");
});

test("the published Lesson 2 converts to a studio deck with its slides and editors", () => {
  const page = fs.readFileSync(
    path.join(import.meta.dirname, "..", "public", "classes", "ml-intensive-tlf", "l02-numpy-pandas", "present.html"),
    "utf8",
  );
  const parts = slidesOfPage(page);
  assert.ok(parts);
  const { html } = inlineClassStyles(parts.slides, parts.css);
  const deck = sanitizeDeck(html);
  const editors = (s) => (s.match(/<script type="py-editor"/g) ?? []).length;
  assert.equal((deck.match(/<section\b/g) ?? []).length, (parts.slides.match(/<section\b/g) ?? []).length);
  assert.equal(editors(deck), editors(parts.slides));
  assert.match(deck, /env="shared" config='\{"packages":\["numpy"\]\}'/);
  assert.match(deck, /class="important" style="color:orange"/); // sanitize-html normalizes the spacing
});
