/* Live annotation layer for lecture decks.
 *
 * Loaded by the generated present.html (see export_decks.py). Plain ES2017, no
 * bundler, no framework — the page is a standalone static file.
 *
 * Two modes, decided by the `?session=<id>` query parameter:
 *   - present mode (session present): toolbar, pen input, autosave, PDF export.
 *   - view mode   (no session):       just the slides, nothing else attached.
 *
 * Blank boards are **real reveal sections** injected into the deck at runtime
 * (white background, square grid), not an overlay: they navigate, export and
 * behave exactly like slides. The deck file on disk is never modified — the
 * session's `boards` list records where each one went so a reload restores them.
 *
 * Ink is keyed by a stable `data-mlp-id` stamped on every original slide at
 * startup, *before* any board is inserted. That is what makes inserting and
 * deleting boards safe: reveal's h.v indices shift, `data-mlp-id` does not.
 *
 * Coordinates: strokes are normalized to the *slide box* (the transformed
 * `.slides` element). reveal runs at a fixed 1280x720, so the box keeps one
 * aspect ratio and ink lands in the same place at any window size — and at PDF
 * export scale.
 */
(function () {
  "use strict";

  var body = document.body;
  var SESSION = new URLSearchParams(location.search).get("session");
  var CLASS = body.dataset.class;
  var LESSON = body.dataset.lesson;
  var API = "/api/classes/" + encodeURIComponent(CLASS) + "/sessions/" +
            encodeURIComponent(SESSION || "");

  // Red is deliberately absent: it belongs to the laser alone, so a red mark on
  // screen always means "pointer, not ink".
  var COLORS = ["#1b6ef3", "#111111", "#18a558", "#f2b202"];
  var WIDTHS = [2, 4, 8];
  var GRID_PX = 40;              // board grid pitch in slide-box pixels
  var ERASE_R = 0.012;           // eraser hit radius in normalized units
  var SAVE_DELAY = 1500;

  // Laser trail, following Notability's "Tail" behaviour: the trail is tied to
  // pointer *movement*, not to each point's age. It stays whole for as long as
  // the pointer keeps moving, only starts to fade once you hold still, and
  // moving again pulls it back — so a pause mid-explanation costs nothing.
  var LASER_COLOR = "#ff1f1f";
  var LASER_W = 7;
  var LASER_HOLD = 350;          // stillness tolerated before the fade begins
  var LASER_FADE = 900;          // ms from full strength to gone
  var LASER_REVIVE = 200;        // ms to restore a partly faded trail
  var LASER_GAP = 200;           // pointer gap that breaks the path
  var LASER_MAX_PTS = 4000;      // safety cap on one continuous trail

  // ------------------------------------------------------------------ state

  var strokes = {};   // slideId -> [stroke]
  var undoStack = {};
  var redoStack = {};
  var boardList = []; // [{id, afterId}] in insertion order
  var boardSeq = 0;

  var tool = "pen";   // pen | highlighter | eraser | laser
  var laserTail = true;
  var drawing = false;
  var penOn = false;
  var color = COLORS[0];
  var width = WIDTHS[1];

  var canvas, ctx, laser, lctx, toolbar, statusEl;
  var live = null;
  var erased = null;
  var saveTimers = {};
  var laserPts = [];  // [{x, y, brk}] normalized; brk starts a new sub-path
  var laserRaf = null;
  var laserFade = 0;      // 0 = fully drawn, 1 = gone
  var laserMoveAt = 0;    // when the pointer last moved
  var laserFrameAt = 0;   // previous frame's timestamp, for dt

  // --------------------------------------------------------------- geometry

  function slideBox() {
    var el = document.querySelector(".reveal .slides");
    if (!el) return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) {
      return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    }
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  /** Stable id of the slide currently on screen; also the ink storage key. */
  function pageKey() {
    var s = Reveal.getCurrentSlide();
    return (s && s.dataset.mlpId) || "s0";
  }

  function isBoard(section) {
    return !!section && section.classList.contains("mlp-board");
  }

  /** Assign ids to the deck's own slides. Runs once, before any board exists. */
  function stampIds() {
    Reveal.getSlides().forEach(function (s, i) {
      if (!s.dataset.mlpId) s.dataset.mlpId = "s" + i;
    });
  }

  // ----------------------------------------------------------------- canvas

  /* The canvases cover the whole viewport, but strokes are still stored in
   * slide-box units — the two are deliberately decoupled.
   *
   * Why: a blank board's white grid is painted by reveal's background layer,
   * which is full-screen. If the canvas were sized to the slide box (1280x720
   * plus margin) you could only draw on part of the visible page. Sizing the
   * canvas to the viewport fixes that, while keeping the coordinate system tied
   * to the slide box keeps ink aligned across window sizes and in the PDF.
   * Coordinates outside the box simply fall outside 0..1. */
  function viewport() {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  function sizeCanvases() {
    var v = viewport();
    var dpr = window.devicePixelRatio || 1;
    [canvas, laser].forEach(function (c) {
      c.style.left = "0px";
      c.style.top = "0px";
      c.style.width = v.width + "px";
      c.style.height = v.height + "px";
      c.width = Math.round(v.width * dpr);
      c.height = Math.round(v.height * dpr);
      c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    redraw();
  }

  /** Draw one stroke onto ctx, mapping normalized points into a w*h box. */
  function drawStroke(c, s, w, h, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    var p = s.p;
    if (!p.length) return;
    var scale = w / 1280;
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = s.c;

    if (p.length === 1) {
      c.fillStyle = s.c;
      c.globalAlpha = s.hl ? 0.3 : 1;
      c.beginPath();
      c.arc(ox + p[0][0] * w, oy + p[0][1] * h, Math.max(0.6, s.w * scale / 2), 0, Math.PI * 2);
      c.fill();
      c.restore();
      return;
    }

    if (s.hl) {
      // One path, stroked once: overlapping parts of the same highlighter
      // stroke must not darken each other.
      c.globalAlpha = 0.3;
      c.lineWidth = s.w * 4 * scale;
      c.lineCap = "butt";
      c.beginPath();
      c.moveTo(ox + p[0][0] * w, oy + p[0][1] * h);
      for (var i = 1; i < p.length - 1; i++) {
        var mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
        c.quadraticCurveTo(ox + p[i][0] * w, oy + p[i][1] * h, ox + mx * w, oy + my * h);
      }
      var last = p[p.length - 1];
      c.lineTo(ox + last[0] * w, oy + last[1] * h);
      c.stroke();
      c.restore();
      return;
    }

    for (var j = 1; j < p.length; j++) {
      var a = p[j - 1], b2 = p[j];
      var pr = ((a[2] || 1) + (b2[2] || 1)) / 2;
      c.lineWidth = Math.max(0.4, s.w * scale * (0.55 + 0.9 * pr));
      c.beginPath();
      if (j === 1) {
        c.moveTo(ox + a[0] * w, oy + a[1] * h);
      } else {
        var pm = p[j - 2];
        c.moveTo(ox + (pm[0] + a[0]) / 2 * w, oy + (pm[1] + a[1]) / 2 * h);
      }
      var m2x = (a[0] + b2[0]) / 2, m2y = (a[1] + b2[1]) / 2;
      c.quadraticCurveTo(ox + a[0] * w, oy + a[1] * h, ox + m2x * w, oy + m2y * h);
      c.stroke();
    }
    c.restore();
  }

  function redraw() {
    var b = slideBox(), v = viewport();
    ctx.clearRect(0, 0, v.width, v.height);
    var list = strokes[pageKey()] || [];
    for (var i = 0; i < list.length; i++) {
      drawStroke(ctx, list[i], b.width, b.height, b.left, b.top);
    }
  }

  // ------------------------------------------------------------------ laser

  function laserFrame() {
    var now = performance.now();
    var dt = Math.min(100, now - (laserFrameAt || now));   // clamp: tab wake-ups
    laserFrameAt = now;

    // The whole trail shares one fade level, driven by how long the pointer has
    // been still. Because it is a level and not an age, resuming movement walks
    // it back to full strength instead of restarting from nothing.
    if (now - laserMoveAt < LASER_HOLD) {
      laserFade = Math.max(0, laserFade - dt / LASER_REVIVE);
    } else {
      laserFade = Math.min(1, laserFade + dt / LASER_FADE);
    }
    if (laserFade >= 1) laserPts = [];

    var b = slideBox(), v = viewport();
    lctx.clearRect(0, 0, v.width, v.height);
    var n = laserPts.length;
    if (n) {
      var scale = b.width / 1280;
      // Opacity tracks the fade level linearly: an eased curve holds near full
      // strength and then vanishes in a blink, which reads as a glitch.
      var k = 1 - laserFade;
      lctx.save();
      lctx.lineCap = "round";
      lctx.lineJoin = "round";
      lctx.strokeStyle = LASER_COLOR;
      lctx.fillStyle = LASER_COLOR;
      lctx.shadowColor = LASER_COLOR;
      lctx.shadowBlur = 8 * scale;
      lctx.globalAlpha = k;
      lctx.lineWidth = LASER_W * scale;
      lctx.beginPath();
      for (var i = 0; i < n; i++) {
        var pt = laserPts[i];
        var x = b.left + pt.x * b.width, y = b.top + pt.y * b.height;
        if (i === 0 || pt.brk) lctx.moveTo(x, y);
        else lctx.lineTo(x, y);
      }
      lctx.stroke();
      // A solid head dot, so the pointer is findable even when standing still.
      var head = laserPts[n - 1];
      lctx.beginPath();
      lctx.arc(b.left + head.x * b.width, b.top + head.y * b.height,
               LASER_W * scale * 0.75, 0, Math.PI * 2);
      lctx.fill();
      lctx.restore();
    }

    if (!n) {
      laserRaf = null;   // nothing left to animate
      return;
    }
    laserRaf = requestAnimationFrame(laserFrame);
  }

  function laserPush(pt) {
    var now = performance.now();
    // A pointer that vanished and reappeared elsewhere must not be joined up by
    // a straight line across the slide.
    var brk = laserPts.length > 0 && now - laserMoveAt > LASER_GAP;
    if (!laserPts.length) laserFade = 0;   // a fresh trail starts at full strength
    laserMoveAt = now;
    laserPts.push({ x: pt[0], y: pt[1], brk: brk });
    // "No Tail": keep only the head, so nothing trails behind the cursor.
    if (!laserTail && laserPts.length > 2) laserPts = laserPts.slice(-2);
    if (laserPts.length > LASER_MAX_PTS) laserPts = laserPts.slice(-LASER_MAX_PTS);
    if (!laserRaf) {
      laserFrameAt = now;
      laserRaf = requestAnimationFrame(laserFrame);
    }
  }

  function laserClear() {
    laserPts = [];
    laserFade = 0;
    laserMoveAt = 0;
    var v = viewport();
    if (lctx) lctx.clearRect(0, 0, v.width, v.height);
    if (laserRaf) { cancelAnimationFrame(laserRaf); laserRaf = null; }
  }

  /* The laser is pure timing, and none of it is observable from the DOM — this
   * hook is what makes it testable, and what to log when it misbehaves on the
   * iPad. */
  window.mlpLaser = function () {
    return { fade: laserFade, pts: laserPts.length, tail: laserTail, color: LASER_COLOR };
  };

  // ------------------------------------------------------------------ input

  function toNorm(e) {
    var b = slideBox();
    return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height, pressureOf(e)];
  }

  function pressureOf(e) {
    // Sidecar/mouse report either 0 or a flat 0.5 — treat both as "no pressure"
    // and fall back to a constant width rather than a randomly thin line.
    if (e.pointerType === "pen" && e.pressure > 0 && e.pressure !== 0.5) return e.pressure;
    return 1;
  }

  function onDown(e) {
    if (!penOn || e.button !== 0) return;
    if (e.pointerType === "touch") return;      // palm rejection
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    drawing = true;

    if (tool === "laser") { laserPush(toNorm(e)); return; }
    if (tool === "eraser") {
      erased = [];
      eraseAt(toNorm(e));
      return;
    }
    live = { c: color, w: width, hl: tool === "highlighter", p: [toNorm(e)] };
    var list = strokes[pageKey()] || (strokes[pageKey()] = []);
    list.push(live);
  }

  function onMove(e) {
    if (!penOn) return;
    // The laser follows the pointer without a button held down — it is a
    // pointer, not a pen.
    if (tool === "laser") { e.preventDefault(); laserPush(toNorm(e)); return; }
    if (!drawing) return;
    e.preventDefault();
    var events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    var pts = events.length ? events.map(toNorm) : [toNorm(e)];
    if (tool === "eraser") {
      pts.forEach(eraseAt);
      return;
    }
    for (var i = 0; i < pts.length; i++) {
      var prev = live.p[live.p.length - 1];
      var pt = pts[i];
      if (Math.abs(pt[0] - prev[0]) < 0.0008 && Math.abs(pt[1] - prev[1]) < 0.0008) continue;
      live.p.push(pt);
      drawLiveTail();
    }
  }

  function drawLiveTail() {
    var b = slideBox();
    var p = live.p, n = p.length;
    if (n < 2) return;
    if (live.hl) { redraw(); return; }
    var tail = { c: live.c, w: live.w, hl: false, p: p.slice(Math.max(0, n - 3)) };
    drawStroke(ctx, tail, b.width, b.height, b.left, b.top);
  }

  function onUp(e) {
    if (!drawing) return;
    drawing = false;
    e.preventDefault();
    // Lifting the pen means nothing to the laser: the trail is kept alive by
    // movement alone, exactly as it is while hovering.
    if (tool === "laser") return;

    var key = pageKey();
    if (tool === "eraser") {
      if (erased && erased.length) {
        push(key, { kind: "erase", items: erased });
        touch(key);
      }
      erased = null;
      return;
    }
    if (live && live.p.length) {
      push(key, { kind: "add", idx: strokes[key].indexOf(live), stroke: live });
      touch(key);
    }
    live = null;
    redraw();
  }

  function eraseAt(pt) {
    var key = pageKey();
    var list = strokes[key] || [];
    for (var i = list.length - 1; i >= 0; i--) {
      if (hits(list[i], pt)) {
        erased.push({ idx: i, stroke: list[i] });
        list.splice(i, 1);
      }
    }
    redraw();
  }

  function hits(s, pt) {
    var p = s.p, r = ERASE_R + s.w / 1280;
    for (var i = 0; i < p.length; i++) {
      if (i > 0 && segDist(p[i - 1], p[i], pt) < r) return true;
      if (Math.abs(p[i][0] - pt[0]) < r && Math.abs(p[i][1] - pt[1]) < r) return true;
    }
    return false;
  }

  function segDist(a, b, p) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var len = dx * dx + dy * dy;
    var t = len ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len : 0;
    t = Math.max(0, Math.min(1, t));
    var qx = a[0] + t * dx - p[0], qy = a[1] + t * dy - p[1];
    return Math.sqrt(qx * qx + qy * qy);
  }

  // ------------------------------------------------------------ undo / redo

  function push(key, op) {
    (undoStack[key] || (undoStack[key] = [])).push(op);
    if (undoStack[key].length > 200) undoStack[key].shift();
    redoStack[key] = [];
  }

  function undo() {
    var key = pageKey();
    var st = undoStack[key];
    if (!st || !st.length) return;
    var op = st.pop();
    var list = strokes[key] || (strokes[key] = []);
    if (op.kind === "add") {
      var i = list.indexOf(op.stroke);
      if (i >= 0) list.splice(i, 1);
    } else if (op.kind === "erase") {
      op.items.slice().reverse().forEach(function (it) {
        list.splice(Math.min(it.idx, list.length), 0, it.stroke);
      });
    } else if (op.kind === "clear") {
      strokes[key] = op.items.slice();
    }
    (redoStack[key] || (redoStack[key] = [])).push(op);
    redraw();
    touch(key);
  }

  function redo() {
    var key = pageKey();
    var st = redoStack[key];
    if (!st || !st.length) return;
    var op = st.pop();
    var list = strokes[key] || (strokes[key] = []);
    if (op.kind === "add") {
      list.splice(Math.min(op.idx, list.length), 0, op.stroke);
    } else if (op.kind === "erase") {
      op.items.forEach(function (it) {
        var i = list.indexOf(it.stroke);
        if (i >= 0) list.splice(i, 1);
      });
    } else if (op.kind === "clear") {
      strokes[key] = [];
    }
    (undoStack[key] || (undoStack[key] = [])).push(op);
    redraw();
    touch(key);
  }

  function clearPage() {
    var key = pageKey();
    var list = strokes[key] || [];
    if (!list.length) return;
    push(key, { kind: "clear", items: list.slice() });
    strokes[key] = [];
    redraw();
    touch(key);
  }

  // --------------------------------------------------------------- persist

  function touch(key) {
    if (!SESSION) return;
    clearTimeout(saveTimers[key]);
    saveTimers[key] = setTimeout(function () { save(key); }, SAVE_DELAY);
    status("saving…");
  }

  function save(key, unloading) {
    delete saveTimers[key];
    var opts = {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pageKey: key, strokes: strokes[key] || [] })
    };
    // On unload a normal fetch is allowed to be cancelled; `keepalive` is the
    // one documented way to make the browser finish it after the page is gone.
    if (unloading) opts.keepalive = true;
    fetch(API + "/annotations", opts).then(function (r) {
      status(r.ok ? "saved" : "save failed (" + r.status + ")");
    }).catch(function () { status("offline — ink kept in this tab"); });
  }

  function flushSaves(unloading) {
    Object.keys(saveTimers).forEach(function (k) {
      clearTimeout(saveTimers[k]);
      save(k, unloading);
    });
  }

  /* Each PUT replaces the whole board list, so two of them in flight at once can
   * land out of order and resurrect a deleted board or drop a new one. Chaining
   * them keeps the last write the last one to arrive. */
  var boardChain = Promise.resolve();

  function saveBoards(unloading) {
    if (!SESSION) return boardChain;
    var opts = {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ boards: boardList })
    };
    if (unloading) opts.keepalive = true;
    boardChain = boardChain.then(function () {
      return fetch(API + "/boards", opts).then(function (r) {
        if (!r.ok) status("board list not saved (" + r.status + ")");
      }).catch(function () { status("board list not saved — offline"); });
    });
    return boardChain;
  }

  function restore() {
    if (!SESSION) return Promise.resolve();
    return fetch(API + "/annotations", { credentials: "include" })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (data) {
        (data.pages || []).forEach(function (row) {
          strokes[row.pageKey] = row.strokes || [];
        });
        restoreBoards(data.boards || []);
        if (data.deckHash && body.dataset.deckHash &&
            data.deckHash !== body.dataset.deckHash) {
          status("⚠ deck changed since this session started — ink may be misplaced");
        }
        redraw();
      })
      .catch(function () { status("could not load saved ink"); });
  }

  // ----------------------------------------------------------------- boards

  /** White page with a square grid, as a real reveal section. */
  function makeBoardEl(id) {
    var grid =
      "data:image/svg+xml;utf8," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + GRID_PX + '" height="' + GRID_PX + '">' +
        '<path d="M ' + GRID_PX + ' 0 L 0 0 0 ' + GRID_PX + '" fill="none" ' +
        'stroke="#d8dee7" stroke-width="1"/></svg>');
    var el = document.createElement("section");
    el.className = "mlp-board";
    el.dataset.mlpId = id;
    el.dataset.backgroundColor = "#ffffff";
    el.dataset.backgroundImage = grid;
    el.dataset.backgroundRepeat = "repeat";
    el.dataset.backgroundSize = GRID_PX + "px " + GRID_PX + "px";
    return el;
  }

  function elById(id) {
    return document.querySelector('.reveal .slides [data-mlp-id="' + id + '"]');
  }

  /** Insert a board immediately after `afterEl`, in the same parent.
   *
   * Same parent means the board lands exactly where you are: a vertical sibling
   * inside a stack, or a new horizontal slide when the anchor is top-level.
   */
  function insertBoard(id, afterEl) {
    var el = makeBoardEl(id);
    afterEl.parentNode.insertBefore(el, afterEl.nextSibling);
    return el;
  }

  function addBoard() {
    var cur = Reveal.getCurrentSlide();
    if (!cur) return;
    var afterId = cur.dataset.mlpId;
    var id = "b" + (++boardSeq);
    while (elById(id)) id = "b" + (++boardSeq);   // never reuse an id
    var el = insertBoard(id, cur);
    boardList.push({ id: id, afterId: afterId });
    Reveal.sync();
    var ix = Reveal.getIndices(el);
    Reveal.slide(ix.h, ix.v);
    saveBoards();
    updateUi();
  }

  function deleteBoard() {
    var cur = Reveal.getCurrentSlide();
    if (!isBoard(cur)) return;
    var id = cur.dataset.mlpId;
    var count = (strokes[id] || []).length;
    if (count && !confirm("Delete this board and its " + count + " stroke(s)?")) return;

    // Step back before removing, so reveal never points at a detached node.
    var ix = Reveal.getIndices(cur);
    var parent = cur.parentNode;
    cur.remove();
    // A stack left with a single child confuses reveal's vertical navigation;
    // it is happier if we just resync and clamp the index.
    Reveal.sync();
    var total = Reveal.getTotalSlides();
    if (total > 0) {
      Reveal.slide(Math.max(0, Math.min(ix.h, Reveal.getHorizontalSlides().length - 1)),
                   Math.max(0, (ix.v || 0) - 1));
    }
    void parent;

    delete strokes[id];
    delete undoStack[id];
    delete redoStack[id];
    clearTimeout(saveTimers[id]);
    delete saveTimers[id];
    boardList = boardList.filter(function (b) { return b.id !== id; });
    // Any board anchored to the deleted one re-anchors to what it followed.
    var gone = id;
    boardList.forEach(function (b) {
      if (b.afterId === gone) b.afterId = null;
    });
    saveBoards();
    if (SESSION) {
      fetch(API + "/annotations?pageKey=" + encodeURIComponent(id),
            { method: "DELETE", credentials: "include" }).catch(function () {});
    }
    redraw();
    updateUi();
    status("board deleted");
  }

  function restoreBoards(saved) {
    if (!saved.length) return;
    boardList = [];
    saved.forEach(function (b) {
      if (!b || !b.id) return;
      var anchor = b.afterId ? elById(b.afterId) : null;
      if (!anchor) {
        // Anchor gone (deck edited, or it followed a deleted board): park the
        // board at the end rather than dropping the teacher's notes.
        var all = Reveal.getSlides();
        anchor = all[all.length - 1];
      }
      if (!anchor) return;
      insertBoard(b.id, anchor);
      boardList.push({ id: b.id, afterId: b.afterId || null });
      var m = /^b(\d+)$/.exec(b.id);
      if (m) boardSeq = Math.max(boardSeq, parseInt(m[1], 10));
    });
    Reveal.sync();
  }

  // -------------------------------------------------------------------- ui

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function btn(cls, label, title, onclick) {
    var b = el("button", "ink-btn " + cls, label);
    b.title = title;
    b.onclick = onclick;
    toolbar.appendChild(b);
    return b;
  }

  function buildToolbar() {
    toolbar = el("div", "ink-bar");

    btn("ink-pen", "✏️", "Draw (d)", function () { setTool("pen"); setPen(!penOn || tool !== "pen"); });

    COLORS.forEach(function (c) {
      var b = el("button", "ink-swatch");
      b.style.background = c;
      b.title = "Colour";
      b.dataset.color = c;
      b.onclick = function () {
        color = c;
        // Colours are the pen's; picking one is how you leave eraser or laser.
        if (tool === "eraser" || tool === "laser") setTool("pen");
        setPen(true);
      };
      toolbar.appendChild(b);
    });

    WIDTHS.forEach(function (w) {
      var b = el("button", "ink-btn ink-w");
      b.dataset.w = String(w);
      b.title = "Thickness";
      var dot = el("span", "ink-dot");
      dot.style.width = dot.style.height = (w + 3) + "px";
      b.appendChild(dot);
      b.onclick = function () { width = w; if (tool === "eraser") setTool("pen"); setPen(true); };
      toolbar.appendChild(b);
    });

    btn("ink-hl", "🖍", "Highlighter (h)", function () {
      setTool(tool === "highlighter" ? "pen" : "highlighter"); setPen(true);
    });
    btn("ink-er", "🧽", "Eraser (e)", function () {
      setTool(tool === "eraser" ? "pen" : "eraser"); setPen(true);
    });
    btn("ink-laser-btn", "🔴", "Red laser pointer (l) — nothing is saved", function () {
      setTool(tool === "laser" ? "pen" : "laser"); setPen(true);
    });
    btn("ink-tail", "〜", "Laser: Tail (stays while you move) / No Tail", function () {
      laserTail = !laserTail;
      if (!laserTail) laserClear();
      status("laser: " + (laserTail ? "Tail" : "No Tail"));
      updateUi();
    });

    btn("", "↶", "Undo (u)", undo);
    btn("", "↷", "Redo (Shift+U)", redo);
    btn("", "⌫", "Clear ink on this page", clearPage);
    btn("ink-add-board", "▦+", "Insert a blank grid board after this slide (b)", addBoard);
    btn("ink-del-board", "▦−", "Delete this board (Shift+B)", deleteBoard);
    btn("ink-finish", "Finish lesson", "Render every slide with your notes to a PDF", finishLesson);

    statusEl = el("span", "ink-status", "");
    toolbar.appendChild(statusEl);
    document.body.appendChild(toolbar);

    // The bar must never sit in the projected image for long.
    var hideTimer;
    function wake() {
      toolbar.classList.remove("ink-bar-idle");
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        if (!drawing) toolbar.classList.add("ink-bar-idle");
      }, 3000);
    }
    ["pointermove", "keydown", "pointerdown"].forEach(function (ev) {
      document.addEventListener(ev, wake, true);
    });
    wake();
  }

  function setTool(t) {
    if (tool === "laser" && t !== "laser") laserClear();
    tool = t;
    updateUi();
  }

  function setPen(on) {
    penOn = on;
    canvas.style.pointerEvents = on ? "auto" : "none";
    document.body.classList.toggle("ink-active", on);
    if (!on) laserClear();
    updateUi();
  }

  function updateUi() {
    if (!toolbar) return;
    var q = function (s) { return toolbar.querySelector(s); };
    q(".ink-pen").classList.toggle("on", penOn && tool === "pen");
    q(".ink-hl").classList.toggle("on", penOn && tool === "highlighter");
    q(".ink-er").classList.toggle("on", penOn && tool === "eraser");
    q(".ink-laser-btn").classList.toggle("on", penOn && tool === "laser");
    q(".ink-tail").classList.toggle("on", laserTail);
    Array.prototype.forEach.call(toolbar.querySelectorAll(".ink-swatch"), function (b) {
      b.classList.toggle("on", b.dataset.color === color);
    });
    Array.prototype.forEach.call(toolbar.querySelectorAll(".ink-w"), function (b) {
      b.classList.toggle("on", Number(b.dataset.w) === width);
    });
    var del = q(".ink-del-board");
    del.disabled = !isBoard(Reveal.getCurrentSlide());
    del.classList.toggle("ink-dim", del.disabled);
  }

  function status(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  // ----------------------------------------------------------------- keys

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

    var claimed = { d: 1, e: 1, h: 1, l: 1, b: 1, B: 1, u: 1, U: 1, Escape: 1 };
    if (!claimed[e.key]) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.key === "d") { setTool("pen"); setPen(!penOn || tool !== "pen"); }
    else if (e.key === "e") { setTool(tool === "eraser" ? "pen" : "eraser"); setPen(true); }
    else if (e.key === "h") { setTool(tool === "highlighter" ? "pen" : "highlighter"); setPen(true); }
    else if (e.key === "l") { setTool(tool === "laser" ? "pen" : "laser"); setPen(true); }
    else if (e.key === "b") addBoard();
    else if (e.key === "B") deleteBoard();
    else if (e.key === "u") undo();
    else if (e.key === "U") redo();
    else if (e.key === "Escape") setPen(false);
  }

  // --------------------------------------------------------------- export

  function progress(pct, text) {
    var box = document.getElementById("ink-progress");
    if (!box) {
      box = el("div", null, null);
      box.id = "ink-progress";
      box.innerHTML = '<div class="ink-prog-inner">' +
        '<div class="ink-prog-text"></div>' +
        '<div class="ink-prog-track"><div class="ink-prog-bar"></div></div></div>';
      document.body.appendChild(box);
    }
    box.querySelector(".ink-prog-text").textContent = text;
    box.querySelector(".ink-prog-bar").style.width = Math.round(pct * 100) + "%";
    return box;
  }

  function raf() {
    return new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 0); }); });
  }

  async function finishLesson() {
    if (!SESSION) { alert("This deck is open in view mode — no lesson session."); return; }
    if (!window.jspdf || !window.html2canvas) {
      alert("PDF libraries did not load; cannot export."); return;
    }
    if (!confirm("Finish the lesson and save a PDF of every slide with your notes " +
                 "to your downloads?")) return;

    var wasPen = penOn;
    setPen(false);
    laserClear();
    flushSaves();

    // Boards are real slides now, so this is simply every page of the deck.
    var pages = Reveal.getSlides().map(function (s) {
      var ix = Reveal.getIndices(s);
      return { id: s.dataset.mlpId, h: ix.h, v: ix.v || 0 };
    });
    var revealEl = document.querySelector(".reveal");
    var rect = revealEl.getBoundingClientRect();
    var SCALE = 1.5;
    var W = Math.round(rect.width), H = Math.round(rect.height);
    var pdf = new window.jspdf.jsPDF({
      orientation: W >= H ? "landscape" : "portrait",
      unit: "px", format: [W, H], compress: true
    });

    var restoreCfg = { transition: Reveal.getConfig().transition };
    Reveal.configure({ transition: "none" });
    var startIndices = Reveal.getIndices();
    toolbar.style.visibility = "hidden";

    /* Force the paint order for the capture.
     *
     * reveal puts `.slides` before `.backgrounds` in the DOM and lifts it with a
     * stylesheet `z-index: 1`. html2canvas ignores that stylesheet rule and
     * paints siblings in DOM order, so `.backgrounds` ends up on top — and any
     * slide with an opaque `data-background-color` came out completely blank
     * (which is what swallowed the code and image slides). Inline z-index *is*
     * honoured, so state the intended order explicitly. */
    var slidesEl = document.querySelector(".reveal .slides");
    var bgEl = document.querySelector(".reveal .backgrounds");
    var savedZ = { slides: slidesEl ? slidesEl.style.zIndex : "", bg: bgEl ? bgEl.style.zIndex : "" };
    if (slidesEl) slidesEl.style.zIndex = "10";
    if (bgEl) bgEl.style.zIndex = "1";

    try {
      for (var i = 0; i < pages.length; i++) {
        var pg = pages[i];
        progress(i / pages.length, "Rendering page " + (i + 1) + " of " + pages.length + "…");
        await raf();

        Reveal.slide(pg.h, pg.v);
        await raf();
        var cur = Reveal.getCurrentSlide();
        if (cur) {
          // Reveal every fragment: a study PDF should not hide half the slide.
          Array.prototype.forEach.call(cur.querySelectorAll(".fragment"), function (f) {
            f.classList.add("visible");
          });
        }
        if (window.mlpFitCurrentSlide) window.mlpFitCurrentSlide();
        await raf();

        var shot = await window.html2canvas(revealEl, {
          scale: SCALE, backgroundColor: "#ffffff", useCORS: true,
          logging: false, width: W, height: H
        });
        var out = document.createElement("canvas");
        out.width = Math.round(W * SCALE);
        out.height = Math.round(H * SCALE);
        var oc = out.getContext("2d");
        oc.drawImage(shot, 0, 0, out.width, out.height);

        // Composite ink: strokes are normalized to the slide box, which sits at
        // an offset inside the captured .reveal rect.
        var list = strokes[pg.id] || [];
        if (list.length) {
          var box = slideBox();
          var ox = (box.left - rect.left) * SCALE;
          var oy = (box.top - rect.top) * SCALE;
          for (var s = 0; s < list.length; s++) {
            drawStroke(oc, list[s], box.width * SCALE, box.height * SCALE, ox, oy);
          }
        }

        if (i > 0) pdf.addPage([W, H], W >= H ? "landscape" : "portrait");
        pdf.addImage(out.toDataURL("image/jpeg", 0.8), "JPEG", 0, 0, W, H);
      }

      progress(0.98, "Saving the PDF…");
      var blob = pdf.output("blob");
      var name = pdfName();

      // Close the session *before* handing over the file. Clicking an
      // `<a download>` aborts requests that start after it, which silently ate
      // this call when it ran second. `keepalive` covers the teacher closing the
      // tab as soon as the download appears.
      //
      // Nothing is uploaded: the PDF goes to the teacher's downloads and they
      // share it with the class themselves. This only records that the lesson
      // happened, so the class page can show which ones have been delivered.
      try {
        await fetch(API + "/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          keepalive: true,
          body: JSON.stringify({ bytes: blob.size })
        });
      } catch (e) {
        // The PDF is what matters; failing to record the end of the lesson is
        // not worth interrupting the teacher over.
      }

      download(blob, name);
      progress(1, "Saved: " + name + " (" + Math.round(blob.size / 104857.6) / 10 + " MB)");
      setTimeout(function () {
        var b = document.getElementById("ink-progress");
        if (b) b.remove();
      }, 4000);
    } finally {
      if (slidesEl) slidesEl.style.zIndex = savedZ.slides;
      if (bgEl) bgEl.style.zIndex = savedZ.bg;
      toolbar.style.visibility = "";
      Reveal.configure(restoreCfg);
      Reveal.slide(startIndices.h, startIndices.v);
      setPen(wasPen);
      sizeCanvases();
    }
  }

  /** A filename worth sharing: class, lesson and the date of the lecture. */
  function pdfName() {
    var d = new Date();
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var stamp = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    return CLASS + "-" + LESSON + "-" + stamp + ".pdf";
  }

  function download(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
  }

  // ------------------------------------------------------------------ init

  function init() {
    stampIds();

    canvas = el("canvas", "ink-canvas");
    ctx = canvas.getContext("2d");
    canvas.style.pointerEvents = "none";
    laser = el("canvas", "ink-laser");
    lctx = laser.getContext("2d");
    document.body.appendChild(canvas);
    document.body.appendChild(laser);

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    buildToolbar();
    updateUi();   // the bar must show the current tool/colour before restore() lands
    document.addEventListener("keydown", onKey, true);

    window.addEventListener("resize", sizeCanvases);
    Reveal.on("resize", sizeCanvases);
    Reveal.on("slidechanged", function () {
      laserClear();
      // Leaving a page flushes it at once, so the debounce can only ever risk
      // the strokes made in the last moment on the page you are still looking at.
      flushSaves();
      updateUi();
      redraw();
    });
    // Ink is debounced, so it needs a keepalive flush on the way out. The board
    // list is not: it is written the moment a board is added or deleted, and
    // re-sending it here would race the next page load's GET and briefly show a
    // stale list.
    window.addEventListener("beforeunload", function () {
      flushSaves(true);
    });

    // Practice links must not navigate the deck away mid-lecture.
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a.practice");
      if (a && !a.target) { a.target = "_blank"; a.rel = "noopener"; }
    }, true);

    sizeCanvases();
    restore().then(function () { sizeCanvases(); updateUi(); });
  }

  function start() {
    if (!SESSION) return;   // view mode: leave the deck untouched
    if (window.Reveal && Reveal.isReady()) init();
    else if (window.Reveal) Reveal.on("ready", init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
