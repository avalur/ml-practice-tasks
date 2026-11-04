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

/* PyScript editors are the one script a studio deck may carry: kept with their
 * code, and nothing else about them. */
test("keeps py-editors, with only env, and drops every other script type", () => {
  const out = sanitizeDeck(`<section><script type="py-editor" env="shared" setup config="https://evil.example/c.toml" src="https://evil.example/x.py">
for i in range(3):
    if i < 2 and i > 0:
        print(i)
</script>
<script type='py-editor'>print("plain")</script>
<script type="py">import js; js.alert(1)</script><script type="module">alert(2)</script>
<script type="text/py-editor">x</script><script type="py-editor-x">y</script></section>`);
  assert.ok(out.includes('<script type="py-editor" env="shared">\nfor i in range(3):\n    if i < 2 and i > 0:'), out);
  assert.ok(out.includes('<script type="py-editor">print("plain")</script>'), out);
  for (const bad of ["setup", "config", "evil.example", 'type="py"', "js.alert", "module", "alert(2)", "text/py-editor", "py-editor-x"]) {
    assert.ok(!out.includes(bad), `${bad} survived: ${out}`);
  }
  assert.equal((out.match(/<script/g) ?? []).length, 2, out);
});

test("editor code can neither close its script nor open a comment", () => {
  const out = sanitizeDeck(`<section><script type="py-editor">s = "<!--<script"
</SCRIPT ><img src=x onerror=alert(1)></script></section>`);
  // The regex stops at the first </script>, so the rest is markup and is sanitized.
  assert.ok(!/onerror/i.test(out), out);
  const one = sanitizeDeck(`<section><script type="py-editor">print("</scr" + "ipt>")
print('<!-- not a comment')</script></section>`);
  assert.ok(!one.includes("<!--"), one);
  assert.equal((one.match(/<\/script/gi) ?? []).length, 1, one);
});

test("an editor smuggled into an attribute comes back as text, not a tag", () => {
  const out = sanitizeDeck(`<section><img src="${ASSET}" alt='<script type="py-editor">" onerror="alert(1)</script>'>
<p title="<script type='py-editor'>x</script>">t</p></section>`);
  assert.ok(!/onerror="alert/.test(out), out);
  assert.ok(!/<script/.test(out), out);
});

test("sanitizing twice changes nothing (save, then render)", () => {
  const deck = `<section><script type="py-editor" env="a">print("</script>")\nx = '<!--'</script><p>t</p></section>`;
  const once = sanitizeDeck(deck);
  assert.equal(sanitizeDeck(once), once);
});
