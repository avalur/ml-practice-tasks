/* Scale down slides whose content is taller than the slide box.
 *
 * Loaded by the generated present.html for both view and present mode.
 *
 * Why this exists: measured against the source decks, 74 of 341 slides already
 * overflowed a 1440x810 window (worst case 226% of the content box) — the
 * overflow simply scrolled off the bottom and nobody noticed during a live talk.
 * The lecture PDF makes it visible and permanent, so overflowing slides get a
 * uniform scale instead of being clipped.
 *
 * Only the *current* slide can be measured: reveal keeps the others at
 * display:none, where offsetHeight is 0. So the fit runs on ready, on every
 * slidechanged, and on resize — which is also exactly when the PDF export walks
 * the deck, so every exported page is fitted too.
 *
 * Fragments do not affect this: reveal hides them with opacity/visibility, so a
 * section already reserves its final height before any fragment appears.
 */
(function () {
  "use strict";

  // Below this, text stops being readable from the back of a room; such a slide
  // is better split in two, so it keeps its old clipped behaviour and is tagged
  // with data-autofit-clipped for the author to find later.
  var MIN_SCALE = 0.5;

  function contentHeight(section) {
    var h = 0;
    for (var i = 0; i < section.children.length; i++) {
      var child = section.children[i];
      if (child.tagName === "ASIDE") continue; // speaker notes are not rendered
      var bottom = child.offsetTop + child.offsetHeight;
      if (bottom > h) h = bottom;
    }
    return h;
  }

  function fitCurrent() {
    var box = document.querySelector(".reveal .slides");
    var section = window.Reveal && Reveal.getCurrentSlide();
    if (!box || !section) return;

    // Measure unscaled, otherwise the previous fit feeds back into this one.
    section.style.transform = "";
    section.style.transformOrigin = "";
    delete section.dataset.autofit;
    delete section.dataset.autofitClipped;

    var avail = box.offsetHeight;
    var needed = contentHeight(section);
    if (!avail || !needed || needed <= avail) return;

    var scale = avail / needed;
    if (scale < MIN_SCALE) {
      section.dataset.autofitClipped = needed + "/" + avail;
      scale = MIN_SCALE;
    }
    // reveal only centres slides that fit, so an overflowing one already sits at
    // top: 0 — scaling from the top edge keeps it there.
    section.style.transformOrigin = "top center";
    section.style.transform = "scale(" + scale.toFixed(4) + ")";
    section.dataset.autofit = scale.toFixed(3);
  }

  // The PDF exporter calls this after forcing every fragment visible.
  window.mlpFitCurrentSlide = fitCurrent;

  /* Measuring once is not enough. Two things land after `ready` and both change
   * text metrics: the theme's Google Fonts (Quicksand/Open Sans) swap in, and the
   * KaTeX plugin renders math asynchronously. A slide measured before either can
   * look like it fits and then overflow. So re-measure on a short ladder after
   * every slide change, and again once fonts report ready. */
  var RETRIES = [60, 400, 1200];

  function fitSoon() {
    fitCurrent();
    RETRIES.forEach(function (ms) { setTimeout(fitCurrent, ms); });
  }

  function start() {
    if (!window.Reveal) return;
    Reveal.on("ready", fitSoon);
    Reveal.on("slidechanged", fitSoon);
    Reveal.on("resize", fitCurrent);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitCurrent).catch(function () {});
    }
    if (Reveal.isReady()) fitSoon();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
