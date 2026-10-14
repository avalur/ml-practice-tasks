import { test } from "node:test";
import assert from "node:assert/strict";

// Real implementations under test (no local dummy copies!)
import {
  computeAssignmentCellState,
  getGradeEndpoint,
  getDownloadEndpoint,
  lessonMatrixItems,
} from "../src/lib/classes-shared.ts";
import {
  renderFeedbackMarkdown,
  isSafeHref,
} from "../src/lib/feedback-render.ts";
import {
  validateGrade,
  validateFeedback,
  findAssignmentInLesson,
} from "../src/lib/submissions.ts";

test("computeAssignmentCellState: accurately reflects cell states from classes-shared.ts", () => {
  const assignment = {
    type: "assignment",
    id: "hw-react-agent",
    title: "Build a ReAct Agent",
    maxScore: 100,
  };

  // 1. Not submitted (on time)
  const notSubOnTime = computeAssignmentCellState({
    assignment,
    submission: null,
    overdue: false,
  });
  assert.equal(notSubOnTime.status, "none");
  assert.equal(notSubOnTime.label, "·");
  assert.equal(notSubOnTime.cellClass, "hw-none");
  assert.ok(notSubOnTime.btnClass.includes("hw-sub-none"));
  assert.ok(!notSubOnTime.btnClass.includes("hw-none-late"));
  assert.equal(notSubOnTime.isSubmitted, false);
  assert.equal(notSubOnTime.isGraded, false);

  // 2. Not submitted (overdue)
  const notSubLate = computeAssignmentCellState({
    assignment,
    submission: null,
    overdue: true,
  });
  assert.equal(notSubLate.status, "none-late");
  assert.equal(notSubLate.label, "·");
  assert.equal(notSubLate.cellClass, "hw-none-late");
  assert.ok(notSubLate.btnClass.includes("hw-none-late"));
  assert.ok(notSubLate.title.includes("Overdue"));

  // 3. Submitted awaiting review
  const submitted = computeAssignmentCellState({
    assignment,
    submission: {
      status: "submitted",
      grade: null,
      maxGrade: 100,
    },
    overdue: true, // Should remain "Review" even when past due date
  });
  assert.equal(submitted.status, "submitted");
  assert.equal(submitted.label, "Review");
  assert.equal(submitted.cellClass, "hw-part");
  assert.equal(submitted.btnClass, "hw-sub-submitted");
  assert.ok(submitted.title.includes("Awaiting review"));
  assert.equal(submitted.isSubmitted, true);
  assert.equal(submitted.isGraded, false);

  // 4. Graded
  const graded = computeAssignmentCellState({
    assignment,
    submission: {
      status: "graded",
      grade: 95,
      maxGrade: 100,
    },
    overdue: false,
  });
  assert.equal(graded.status, "graded");
  assert.equal(graded.label, "95/100");
  assert.equal(graded.cellClass, "hw-full");
  assert.equal(graded.btnClass, "hw-sub-graded");
  assert.ok(graded.title.includes("Graded: 95/100"));
  assert.equal(graded.isGraded, true);
});

test("computeAssignmentCellState: authoritative assignment maxScore overrides mismatched DB maxGrade", () => {
  // Assignment declares maxScore: 50
  const assignment50 = {
    type: "assignment",
    id: "hw-mini",
    title: "Mini HW",
    maxScore: 50,
  };

  // DB row has stale or default maxGrade: 100
  const sub = {
    status: "graded",
    grade: 45,
    maxGrade: 100,
  };

  const cell = computeAssignmentCellState({
    assignment: assignment50,
    submission: sub,
    overdue: false,
  });

  // Cell MUST display 45/50 (using assignment's authoritative maxScore), not 45/100!
  assert.equal(cell.label, "45/50");
  assert.ok(cell.title.includes("45/50"));
});

test("Scoped endpoints: getGradeEndpoint and getDownloadEndpoint construct canonical URLs", () => {
  const gradeUrl = getGradeEndpoint("building-ai-agents", "l02-tools-mcp", "sub-abc-123");
  assert.equal(
    gradeUrl,
    "/api/classes/building-ai-agents/lessons/l02-tools-mcp/submissions/sub-abc-123/grade",
  );

  const dlUrl = getDownloadEndpoint("building-ai-agents", "l02-tools-mcp", "sub-abc-123");
  assert.equal(
    dlUrl,
    "/api/classes/building-ai-agents/lessons/l02-tools-mcp/submissions/sub-abc-123/download",
  );
});

test("isSafeHref: strictly rejects dangerous schemes and encoded exploits", () => {
  // Reject javascript
  assert.equal(isSafeHref("javascript:alert(1)"), false);
  assert.equal(isSafeHref("JAVASCRIPT:alert(1)"), false);
  assert.equal(isSafeHref("javascript://alert(1)"), false);
  assert.equal(isSafeHref("  javascript:alert(1)"), false);

  // Reject entity-encoded javascript
  assert.equal(isSafeHref("&#106;avascript:alert(1)"), false);
  assert.equal(isSafeHref("&#x6a;avascript:alert(1)"), false);
  assert.equal(isSafeHref("&#74;avascript:alert(1)"), false);

  // Reject data URIs and vbscript
  assert.equal(isSafeHref("data:text/html,<script>alert(1)</script>"), false);
  assert.equal(isSafeHref("DATA:text/html;base64,PHNjcmlwdD4="), false);
  assert.equal(isSafeHref("vbscript:msgbox(1)"), false);

  // Accept safe URLs
  assert.equal(isSafeHref("https://example.com"), true);
  assert.equal(isSafeHref("http://example.com/test?a=1&b=2"), true);
  assert.equal(isSafeHref("mailto:instructor@example.com"), true);
  assert.equal(isSafeHref("/classes/building-ai-agents"), true);
  assert.equal(isSafeHref("./relative/path"), true);
  assert.equal(isSafeHref("#section-1"), true);

  // Protocol-relative URLs are off-site, not same-origin paths
  assert.equal(isSafeHref("//evil.com"), false);
  assert.equal(isSafeHref("//evil.com/steal"), false);
});

test("renderFeedbackMarkdown: sanitizes raw HTML and prevents XSS", () => {
  // 1. Raw <script> tag disarmed
  const scriptHtml = renderFeedbackMarkdown("<script>alert('pwned')</script>");
  assert.ok(!scriptHtml.includes("<script>"));
  assert.ok(scriptHtml.includes("&lt;script&gt;"));

  // 2. Raw <img> onerror disarmed
  const imgHtml = renderFeedbackMarkdown('<img src="x" onerror="alert(1)">');
  assert.ok(!imgHtml.includes("<img src=\"x\""));
  assert.ok(imgHtml.includes("&lt;img"));

  // 3. Dangerous markdown links neutralized (no href="javascript:")
  const linkHtml = renderFeedbackMarkdown("[Malicious](javascript:alert(document.cookie))");
  assert.ok(!linkHtml.includes("href=\"javascript:"));
  assert.ok(linkHtml.includes("Malicious"));

  // 4. Entity encoded link neutralized
  const entityLink = renderFeedbackMarkdown("[Encoded](&#106;avascript:alert(1))");
  assert.ok(!entityLink.includes("href=\""));
  assert.ok(entityLink.includes("Encoded"));

  // 5. Raw <iframe> disarmed
  const iframeHtml = renderFeedbackMarkdown('<iframe src="https://evil.example"></iframe>');
  assert.ok(!iframeHtml.includes("<iframe"));
  assert.ok(iframeHtml.includes("&lt;iframe"));
});

test("renderFeedbackMarkdown: strictly prevents quote attribute injection XSS in links and images", () => {
  // Payloads verified to inject onmouseover or onerror when href/src are interpolated unescaped
  const payloads = [
    '[x](https://e.com/"onmouseover="alert(1))',
    '[x](<https://e.com/" onmouseover="alert(1)>)',
    '![a](<https://e.com/x.png" onerror="alert(1)>)',
    '![a](https://e.com/x.png"onerror="alert(1))',
    '[x](https://e.com/ "title\\"onmouseover=\\"alert(1)")',
    '![alt"onerror="alert(1)](https://e.com/x.png)',
  ];

  for (const payload of payloads) {
    const rendered = renderFeedbackMarkdown(payload);
    // Attributes must be properly percent-encoded or attribute-escaped; NEVER raw unescaped onmouseover/onerror attributes
    assert.ok(
      !rendered.includes(' onmouseover="') && !rendered.includes('"onmouseover="'),
      `Payload "${payload}" resulted in unescaped onmouseover attribute: ${rendered}`,
    );
    assert.ok(
      !rendered.includes(' onerror="') && !rendered.includes('"onerror="'),
      `Payload "${payload}" resulted in unescaped onerror attribute: ${rendered}`,
    );
  }
});

test("renderFeedbackMarkdown: preserves math syntax inside code spans and fences without converting to KaTeX", () => {
  // 1. Inline code span with $ must remain literal code, not KaTeX
  const inlineCode = "Check `$HOME and $PATH` in your shell script.";
  const renderedInline = renderFeedbackMarkdown(inlineCode);
  assert.ok(renderedInline.includes("<code>$HOME and $PATH</code>"));
  assert.ok(!renderedInline.includes("katex"));

  // 2. Fenced code block with $ must remain literal code inside <pre><code>
  const fencedCode = `\`\`\`bash
echo "$USER in $DIR"
result=$((a + b))
\`\`\``;
  const renderedFenced = renderFeedbackMarkdown(fencedCode);
  assert.ok(renderedFenced.includes("<pre><code"));
  assert.ok(renderedFenced.includes("echo &quot;$USER in $DIR&quot;"));
  assert.ok(renderedFenced.includes("result=$((a + b))"));
  assert.ok(!renderedFenced.includes("katex"));

  // 3. Formula outside code must still render with KaTeX while code alongside it stays literal
  const mixed = "Run `echo $VAR` to compute $x^2 + y^2 = z^2$.";
  const renderedMixed = renderFeedbackMarkdown(mixed);
  assert.ok(renderedMixed.includes("<code>echo $VAR</code>"));
  assert.ok(renderedMixed.includes("katex"));
});

test("renderFeedbackMarkdown: preserves valid markdown formatting without double-escaping", () => {
  // Code block with < and > should NOT be double escaped (&lt; in HTML renders as < to user)
  const codeMd = "Compare `a < b` and `x > y`.";
  const codeHtml = renderFeedbackMarkdown(codeMd);
  assert.ok(codeHtml.includes("<code>a &lt; b</code>"));
  assert.ok(!codeHtml.includes("&amp;lt;"));

  // Blockquotes should render as <blockquote>, not literal text
  const quoteMd = "> This is an important feedback note.";
  const quoteHtml = renderFeedbackMarkdown(quoteMd);
  assert.ok(quoteHtml.includes("<blockquote>"));
  assert.ok(quoteHtml.includes("This is an important feedback note."));

  // Tables should render as <table>
  const tableMd = `| Criterion | Score |
|---|---|
| Precision | 10/10 |`;
  const tableHtml = renderFeedbackMarkdown(tableMd);
  assert.ok(tableHtml.includes("<table>"));
  assert.ok(tableHtml.includes("<th>Criterion</th>"));
  assert.ok(tableHtml.includes("<td>Precision</td>"));

  // Safe links should render properly
  const safeLinkMd = "[Documentation](https://python.org)";
  const safeLinkHtml = renderFeedbackMarkdown(safeLinkMd);
  assert.ok(safeLinkHtml.includes('<a href="https://python.org/"'));
  assert.ok(safeLinkHtml.includes('target="_blank"'));
  assert.ok(safeLinkHtml.includes('rel="noopener noreferrer"'));
});

test("renderFeedbackMarkdown: renders LaTeX equations safely with KaTeX", () => {
  const mathMd = "The loss is $L = \\frac{1}{2}(y - \\hat{y})^2$ in regression.";
  const mathHtml = renderFeedbackMarkdown(mathMd);
  assert.ok(mathHtml.includes("katex"));
  assert.ok(mathHtml.includes("regression."));

  const displayMathMd = "$$\n\\sum_{i=1}^n x_i\n$$";
  const displayHtml = renderFeedbackMarkdown(displayMathMd);
  assert.ok(displayHtml.includes("katex-display"));
});

test("validateGrade and validateFeedback: bounds and types validation", () => {
  // Valid scores within maxGrade
  assert.equal(validateGrade(0, 100).valid, true);
  assert.equal(validateGrade(50, 50).valid, true);
  assert.equal(validateGrade(100, 100).valid, true);

  // Invalid scores
  assert.equal(validateGrade(-1, 100).valid, false);
  assert.equal(validateGrade(101, 100).valid, false);
  assert.equal(validateGrade("95", 100).valid, false);
  assert.equal(validateGrade(true, 100).valid, false);
  assert.equal(validateGrade(null, 100).valid, false);
  assert.equal(validateGrade(NaN, 100).valid, false);
  assert.equal(validateGrade(95.5, 100).valid, false);

  // Invalid maxGrade
  assert.equal(validateGrade(50, 0).valid, false);
  assert.equal(validateGrade(50, -10).valid, false);
  assert.equal(validateGrade(50, true).valid, false);

  // Feedback validation
  assert.equal(validateFeedback("Nice work!").valid, true);
  assert.equal(validateFeedback("   Trimmed   ").feedback, "Trimmed");
  assert.equal(validateFeedback(123).valid, false);
  assert.equal(validateFeedback(null).valid, false);
});

test("renderFeedbackMarkdown: math inside link URL, title and image alt does not break attributes", () => {
  function assertNoKatexInAttrs(html, label) {
    const attrs = [...html.matchAll(/\s(?:href|src|title|alt)="([^"]*)"/g)];
    for (const [, val] of attrs) {
      assert.ok(
        !val.includes("<") && !val.includes("katex") && !val.includes("span"),
        `${label}: KaTeX leaked into attribute value ${JSON.stringify(val)} in ${html}`,
      );
    }
  }

  const urlHtml = renderFeedbackMarkdown("[x](https://e.com/$a$)");
  assertNoKatexInAttrs(urlHtml, "link URL");
  assert.ok(
    urlHtml.includes("$a$") || urlHtml.includes("%24a%24"),
    `link URL should keep TeX source, got: ${urlHtml}`,
  );

  const autolinkHtml = renderFeedbackMarkdown("See https://e.com/$a$x$b$ please.");
  assertNoKatexInAttrs(autolinkHtml, "autolink");

  const titleHtml = renderFeedbackMarkdown('[x](https://e.com "$a$ extra")');
  assertNoKatexInAttrs(titleHtml, "link title");
  assert.ok(titleHtml.includes("$a$"), `title should keep TeX source, got: ${titleHtml}`);

  const altHtml = renderFeedbackMarkdown("![$x$](https://e.com/x.png)");
  assertNoKatexInAttrs(altHtml, "image alt");
  assert.ok(altHtml.includes('alt="$x$"'), `image alt should keep TeX source, got: ${altHtml}`);
});

test("renderFeedbackMarkdown: indented code blocks keep $…$ literal", () => {
  const md = "    echo $HOME and $PATH\n";
  const html = renderFeedbackMarkdown(md);
  assert.ok(html.includes("<pre><code>"), html);
  assert.ok(html.includes("$HOME"), html);
  assert.ok(html.includes("$PATH"), html);
  assert.ok(!html.includes("katex"), html);
});

test("lessonMatrixItems: merges practice assignments without duplicate ids", () => {
  const homeworkOnly = {
    practice: [{ type: "problem", id: "p1" }],
    homework: {
      due: "2026-10-20T23:59",
      items: [{ type: "assignment", id: "hw1", title: "Homework NB", maxScore: 100 }],
    },
  };
  const fromHw = lessonMatrixItems(homeworkOnly);
  assert.equal(fromHw.length, 1);
  assert.equal(fromHw[0].type, "assignment");
  assert.equal(fromHw[0].id, "hw1");

  const practicePlusHw = {
    practice: [
      { type: "link", title: "Colab", href: "https://colab.research.google.com/x" },
      { type: "assignment", id: "practice1", title: "In-class NB", maxScore: 25 },
      { type: "assignment", id: "hw1", title: "Duplicate of homework", maxScore: 50 },
    ],
    homework: {
      due: "2026-10-20T23:59",
      items: [
        { type: "problem", id: "p1" },
        { type: "assignment", id: "hw1", title: "Homework NB", maxScore: 100 },
      ],
    },
  };
  const merged = lessonMatrixItems(practicePlusHw);
  const assignmentIds = merged.filter((i) => i.type === "assignment").map((i) => i.id);
  assert.deepEqual(assignmentIds, ["hw1", "practice1"]);
  assert.equal(merged[0].type, "problem");
  assert.equal(merged[1].id, "hw1");
  assert.equal(merged[1].title, "Homework NB");
  assert.equal(merged[2].id, "practice1");
  // Practice-only links are not mixed into a homework matrix that already has items
  assert.ok(!merged.some((i) => i.type === "link"));

  const practiceOnly = {
    practice: [
      { type: "link", title: "Colab", href: "https://colab.research.google.com/x" },
      { type: "assignment", id: "practice1", title: "In-class NB" },
    ],
    homework: null,
  };
  const fromPractice = lessonMatrixItems(practiceOnly);
  assert.equal(fromPractice.length, 2);
  assert.equal(fromPractice[0].type, "link");
  assert.equal(fromPractice[1].id, "practice1");

  const noAssignments = {
    practice: [{ type: "problem", id: "p1" }],
    homework: { due: "2026-10-20T23:59", items: [{ type: "problem", id: "p2" }] },
  };
  assert.equal(lessonMatrixItems(noAssignments).some((i) => i.type === "assignment"), false);
});

test("findAssignmentInLesson: locates assignment item in practice and homework", () => {
  const lesson = {
    practice: [
      { type: "problem", id: "p1" },
      { type: "assignment", id: "hw-practice", title: "Practice HW", maxScore: 25 },
    ],
    homework: {
      items: [
        { type: "assignment", id: "hw-final", title: "Final HW", maxScore: 100 },
      ],
    },
  };

  const foundPractice = findAssignmentInLesson(lesson, "hw-practice");
  assert.ok(foundPractice);
  assert.equal(foundPractice.maxScore, 25);

  const foundHw = findAssignmentInLesson(lesson, "hw-final");
  assert.ok(foundHw);
  assert.equal(foundHw.maxScore, 100);

  const notFound = findAssignmentInLesson(lesson, "nonexistent");
  assert.equal(notFound, null);
});
