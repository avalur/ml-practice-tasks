/* Live reload for hand-authored decks. Copied to _shared/devreload.js by
 * export_decks.py and loaded by every present page, but inert unless the URL
 * says ?dev=1 — a lecture must never reload itself off a stray file change.
 *
 * Pair it with `python export_decks.py --watch`: save the deck in the editor,
 * the watcher rewrites this page, and the poll below notices and reloads. The
 * deck's own `hash: true` puts you back on the slide you were looking at.
 *
 * It polls with HEAD and compares the ETag, which Next derives from size+mtime.
 * That only works because the exporter writes a page just when its bytes
 * actually change (write_if_changed) — otherwise every rebuild of any lesson
 * would bump the mtime and reload every open tab.
 */
(function () {
  "use strict";

  if (!/[?&]dev=1(&|$)/.test(location.search)) return;

  var INTERVAL = 1000;
  var stamp = null;      // the ETag (or Last-Modified) we believe we are showing
  var misses = 0;        // consecutive failed polls, so a restart isn't fatal
  var badge;

  function show(state, text) {
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "dev-reload-badge";
      document.body.appendChild(badge);
    }
    badge.dataset.state = state;
    badge.textContent = text;
  }

  function tagOf(res) {
    return res.headers.get("etag") || res.headers.get("last-modified") ||
           res.headers.get("content-length");
  }

  function poll() {
    fetch(location.pathname, { method: "HEAD", cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        misses = 0;
        var tag = tagOf(res);
        if (!tag) {
          show("off", "live reload: no ETag");
          return;
        }
        if (stamp === null) {
          stamp = tag;
          show("on", "live");
          return;
        }
        if (tag !== stamp) {
          show("hit", "reloading…");
          location.reload();
        }
      })
      .catch(function () {
        // The dev server restarting is normal; only complain if it persists.
        if (++misses >= 3) show("off", "server?");
      });
  }

  window.addEventListener("load", function () {
    show("on", "live");
    poll();
    setInterval(poll, INTERVAL);
  });
})();
