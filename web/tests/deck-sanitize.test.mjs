import assert from "node:assert/strict";
import { test } from "node:test";

import { sanitizeDeck } from "../src/lib/deck-sanitize.ts";

/* Studio decks are served on the site's own origin, so this sanitizer is what
 * keeps a teacher's slides from acting as the student who opens them. Each
 * case below is a way a slide could run script, load something, or collect
 * input; each must come out inert. */

const ASSET = "/api/studio/assets/clh3x9k2a0000qwerty123456";

test("keeps ordinary reveal markup intact", () => {
  const deck = `<section data-background-color="#123456"><h2 class="r-fit-text">Title</h2>
<ul><li class="fragment">one $x^2$</li></ul><aside class="notes">speaker</aside>
<pre><code class="language-python">print(1 < 2)</code></pre>
<table><tr><td colspan="2">cell</td></tr></table></section>`;
  const out = sanitizeDeck(deck);
  for (const piece of ['data-background-color="#123456"', 'class="r-fit-text"', 'class="fragment"',
    "$x^2$", '<aside class="notes">', 'class="language-python"', 'colspan="2"']) {
    assert.ok(out.includes(piece), `lost ${piece}: ${out}`);
  }
});

test("drops scripts, styles, frames, forms and their contents", () => {
  const out = sanitizeDeck(`<section><script>alert(1)</script><style>body{}</style>
<iframe src="https://evil.example"></iframe><object data="x"></object>
<form action="https://evil.example"><input name="password"><button>Go</button></form>
<svg><script>alert(2)</script></svg><math><mi>x</mi></math><p>kept</p></section>`);
  for (const bad of ["<script", "alert", "<style", "body{}", "<iframe", "<object", "<form", "<input", "<svg", "<math"]) {
    assert.ok(!out.includes(bad), `${bad} survived: ${out}`);
  }
  assert.ok(out.includes("<p>kept</p>"));
});

test("strips event handlers and javascript: links", () => {
  const out = sanitizeDeck(`<section><p onclick="steal()" onmouseover="x()">hi</p>
<a href="javascript:steal()">a</a><a href="  JaVaScRiPt:steal()">b</a><a href="//evil.example/x">c</a></section>`);
  assert.ok(!/on(click|mouseover)/.test(out), out);
  assert.ok(!/javascript:/i.test(out), out);
  assert.ok(!out.includes("//evil.example"), out);
});

test("external links open in a new tab without referrer; site links stay as they are", () => {
  const out = sanitizeDeck(`<section><a href="https://example.org">ext</a>
<a class="practice" href="/problems/py_basics/fizz_buzz">task</a></section>`);
  assert.match(out, /<a href="https:\/\/example.org" target="_blank" rel="noopener noreferrer nofollow">/);
  assert.match(out, /<a class="practice" href="\/problems\/py_basics\/fizz_buzz">task<\/a>/);
});

test("images load only from our asset route or inline data", () => {
  const out = sanitizeDeck(`<section><img src="${ASSET}" alt="ok">
<img src="https://tracker.example/pixel.gif" alt="tracked">
<img src="data:image/png;base64,iVBORw0KGgo=" alt="inline">
<img src="data:text/html;base64,PHNjcmlwdD4=" alt="html"></section>`);
  assert.ok(out.includes(`src="${ASSET}"`), out);
  assert.ok(out.includes("data:image/png;base64"), out);
  assert.ok(!out.includes("tracker.example"), out);
  assert.ok(!out.includes("data:text/html"), out);
});

test("reveal attributes that would load something are not allowed", () => {
  const out = sanitizeDeck(`<section data-background-iframe="https://evil.example"
data-background-video="https://evil.example/v.mp4" data-background-image="https://evil.example/i.png">x</section>
<section data-background-image="${ASSET}">y</section>`);
  assert.ok(!out.includes("evil.example"), out);
  assert.ok(out.includes(`data-background-image="${ASSET}"`), out);
});

test("style attributes lose foreign url() but keep the rest", () => {
  const out = sanitizeDeck(`<section><div style="color: red; background: url('https://evil.example/t.png')">a</div>
<div style="background-image: url(${ASSET})">b</div><a href="/x" style="background:url(https://evil.example/a)">c</a></section>`);
  assert.match(out, /color: ?red/);
  assert.ok(!out.includes("evil.example"), out);
  assert.ok(out.includes(`url(${ASSET})`), out);
});

test("bare content is wrapped into one slide", () => {
  assert.match(sanitizeDeck("<h2>Just a heading</h2>"), /^<section>\s*<h2>Just a heading<\/h2>\s*<\/section>/);
});
