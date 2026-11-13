import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ansiToHtml,
  collapseCarriageReturns,
  highlightPython,
  maskMath,
  MAX_OUTPUT_TEXT,
  NotebookFormatError,
  parseNotebook,
  renderCell,
  renderMarkdown,
  renderNotebookHtml,
  renderOutput,
  sanitizeNotebookHtml,
} from "../src/lib/notebook-render.ts";

/* The notebook is the student's file, and the teacher opens it. Whatever is in
 * it must come out as text or as inert markup — the route's sandbox CSP is the
 * second layer, not the only one. */

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const nb = (cells, metadata = {}) => ({ nbformat: 4, nbformat_minor: 5, metadata, cells });

test("parseNotebook accepts nbformat 4 (with a BOM) and refuses everything else with a reason", () => {
  assert.equal(parseNotebook("﻿" + JSON.stringify(nb([]))).nbformat, 4);
  assert.throws(() => parseNotebook("not json"), NotebookFormatError);
  assert.throws(() => parseNotebook("[1,2]"), NotebookFormatError);
  assert.throws(() => parseNotebook('{"cells": 3}'), NotebookFormatError);
  assert.throws(() => parseNotebook('{"worksheets": []}'), /nbformat 3/);
});

test("renders a typical notebook: markdown, code with prompts, stream, result, image, table", () => {
  const html = renderNotebookHtml(
    nb(
      [
        { cell_type: "markdown", metadata: {}, source: ["# Homework 1\n", "Loss is $L = \\sum_i x_i^2$."] },
        {
          cell_type: "code",
          execution_count: 3,
          metadata: {},
          source: "import numpy as np\nprint('hi')  # say hi\nnp.arange(3)",
          outputs: [
            { output_type: "stream", name: "stdout", text: ["hi\n"] },
            { output_type: "execute_result", execution_count: 3, metadata: {}, data: { "text/plain": "array([0, 1, 2])" } },
            { output_type: "display_data", metadata: {}, data: { "image/png": PNG + "\n", "text/plain": "<Figure>" } },
            {
              output_type: "execute_result", execution_count: 3, metadata: {},
              data: {
                "text/html": '<div><style scoped>.dataframe tbody tr th{vertical-align:top}</style><table border="1" class="dataframe"><thead><tr><th></th><th>a</th></tr></thead><tbody><tr><th>0</th><td>1</td></tr></tbody></table></div>',
                "text/plain": "   a\n0  1",
              },
            },
          ],
        },
      ],
      { kernelspec: { display_name: "Python 3 (ipykernel)", language: "python" }, language_info: { name: "python" } },
    ),
    { title: "hw1.ipynb", meta: ["Ann Student", "Submitted Nov 13, 2026"], downloadHref: "/api/x/download" },
  );
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<title>hw1\.ipynb<\/title>/);
  assert.match(html, /Ann Student · Submitted Nov 13, 2026 · Python 3 \(ipykernel\)/);
  assert.match(html, /<h1[^>]*>Homework 1<\/h1>/);
  assert.match(html, /<math/, "math is rendered to MathML");
  assert.ok(!html.includes("MLPMATH"), "no math placeholder survives");
  assert.match(html, /In\[3\]:/);
  assert.match(html, /Out\[3\]:/);
  assert.match(html, /<span class="tok-keyword">import<\/span>/);
  assert.match(html, /<span class="tok-comment"># say hi<\/span>/);
  assert.match(html, /<pre class="nb-stream">hi\n<\/pre>/);
  assert.match(html, /array\(\[0, 1, 2\]\)/);
  assert.ok(html.includes(`<img src="data:image/png;base64,${PNG}"`), "png output inlined without whitespace");
  assert.match(html, /<table class="dataframe">/);
  assert.ok(!html.includes("vertical-align"), "the DataFrame's <style> is dropped, not shown as text");
  assert.match(html, /href="\/api\/x\/download"/);
});

test("drops script, handlers, frames, forms and foreign images from markdown and HTML outputs", () => {
  const evil = `<script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">j</a>
<iframe src="https://evil.example"></iframe><form action="https://evil.example"><input name=p></form>
<svg onload="alert(4)"><script>alert(5)</script></svg><object data="x"></object><embed src="x">
<img src="https://tracker.example/pixel.png" alt="pixel"><a href="//evil.example">pr</a>
<div style="background:url(https://evil.example/x)">styled</div><meta http-equiv="refresh" content="0;url=https://evil.example">
<base href="https://evil.example/"><link rel="stylesheet" href="https://evil.example/x.css">`;
  const fromMarkdown = renderCell({ cell_type: "markdown", source: evil }, "python");
  // An HTML output with any <script> is treated as interactive (next test), so
  // the output case gets the same payload minus its script tags.
  const fromOutput = renderOutput({
    output_type: "display_data",
    data: { "text/html": evil.replace(/<script>alert\(\d\)<\/script>/g, "") },
  });
  for (const out of [fromMarkdown, fromOutput]) {
    for (const bad of ["<script", "alert(", "onerror", "onload", "javascript:", "<iframe", "<form", "<input",
      "<svg", "<object", "<embed", "tracker.example", "//evil.example", "style=", "<meta", "<base", "<link"]) {
      assert.ok(!out.includes(bad), `${bad} survived: ${out}`);
    }
    assert.match(out, /\[image: pixel\]/, "a foreign image shows its alt text");
    assert.match(out, /styled/);
  }
});

test("an HTML output that needs script falls back to text/plain with a note", () => {
  const out = renderOutput({
    output_type: "display_data",
    data: {
      "text/html": '<div id="p"></div><script>Plotly.newPlot("p", [])</script>',
      "application/vnd.plotly.v1+json": {},
      "text/plain": "Figure({...})",
    },
  });
  assert.ok(!out.includes("<script"));
  assert.match(out, /Interactive output/);
  assert.match(out, /Figure\(\{\.\.\.\}\)/);
});

test("code, streams and tracebacks are escaped, never parsed as HTML", () => {
  const cell = renderCell({
    cell_type: "code",
    execution_count: null,
    source: 'html = "<img src=x onerror=alert(1)>"',
    outputs: [
      { output_type: "stream", name: "stdout", text: "<b>not bold</b>\n" },
      { output_type: "execute_result", data: { "text/plain": "'<script>alert(1)</script>'" } },
      { output_type: "error", ename: "ValueError", evalue: "<bad>", traceback: ["\u001b[0;31mValueError\u001b[0m: <bad>"] },
    ],
  }, "python");
  assert.ok(!/<img|<b>|<script|<bad>/.test(cell), cell);
  assert.match(cell, /In\[ \]:/);
  assert.match(cell, /&lt;b&gt;not bold&lt;\/b&gt;/);
  assert.match(cell, /<span class="ansi-red">ValueError<\/span>: &lt;bad&gt;/);
});

test("SVG outputs become <img> data URIs, so their script cannot run", () => {
  const out = renderOutput({
    output_type: "display_data",
    data: { "image/svg+xml": '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script></svg>' },
  });
  assert.match(out, /^<div class="nb-image"><img src="data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+"/);
  assert.ok(!out.includes("alert"));
});

test("markdown attachments are inlined, unknown ones become text", () => {
  const html = renderCell({
    cell_type: "markdown",
    source: "![plot](attachment:plot.png) ![gone](attachment:missing.png)",
    attachments: { "plot.png": { "image/png": PNG } },
  }, "python");
  assert.ok(html.includes(`src="data:image/png;base64,${PNG}"`));
  assert.match(html, /\[image: gone\]/);
});

test("math inside code is left alone; \\(…\\), \\[…\\] and environments render", () => {
  const { masked, math } = maskMath("cost `$5` and\n```\n$x$\n```\nthen \\(a\\) \\[b\\] \\begin{align}c\\end{align} $d$");
  assert.equal(math.length, 4);
  assert.ok(masked.includes("`$5`"));
  assert.ok(masked.includes("\n```\n$x$\n```\n"));
  const html = renderMarkdown("Inline $a<b$ and $$\\frac{1}{2}$$");
  assert.match(html, /<math[^>]*display="block"/);
  assert.ok(!html.includes("MLPMATH"));
  assert.ok(!html.includes("a<b"), "the < in math is MathML, not raw markup");
});

test("long outputs are cut with a note", () => {
  const out = renderOutput({ output_type: "stream", name: "stdout", text: "x".repeat(MAX_OUTPUT_TEXT + 500) });
  assert.match(out, /500 more characters not shown/);
  assert.ok(out.length < MAX_OUTPUT_TEXT + 1000);
});

test("carriage returns keep only the last state of a progress bar", () => {
  assert.equal(collapseCarriageReturns("10%\r50%\r100%\ndone\n"), "100%\ndone\n");
});

test("ansiToHtml keeps colours and bold, drops other escapes, escapes text", () => {
  assert.equal(ansiToHtml("\u001b[1;32mok\u001b[0m <x>\u001b[2K"), '<span class="ansi-green ansi-bold">ok</span> &lt;x&gt;');
  assert.equal(ansiToHtml("\u001b[38;5;208mo\u001b[39m"), "o");
});

test("highlightPython escapes everything and tags tokens", () => {
  const h = highlightPython("def f(x):  # <c>\n    return 'a<b' + 1.5e3\n@dec\nclass K: pass");
  assert.match(h, /<span class="tok-keyword">def<\/span>/);
  assert.match(h, /<span class="tok-comment"># &lt;c&gt;<\/span>/);
  assert.match(h, /<span class="tok-string">&#39;a&lt;b&#39;<\/span>/);
  assert.match(h, /<span class="tok-number">1\.5e3<\/span>/);
  assert.match(h, /<span class="tok-deco">@dec<\/span>/);
  assert.ok(!h.replace(/<\/?span[^>]*>/g, "").includes("<"));
});

test("a cell that is not an object, or an unknown type, is skipped", () => {
  const html = renderNotebookHtml(nb([null, 3, { cell_type: "weird", source: "x" }]), { title: "t" });
  assert.match(html, /The notebook is empty/);
});

test("links open in a new tab without a referrer", () => {
  const out = sanitizeNotebookHtml('<a href="https://example.org">x</a>');
  assert.equal(out, '<a href="https://example.org" target="_blank" rel="noopener noreferrer nofollow">x</a>');
});
