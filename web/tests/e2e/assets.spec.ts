import { test, expect } from "@playwright/test";

const LESSONS: ReadonlyArray<readonly [cls: string, lesson: string]> = [
  ["ml-intensive-tlf", "l01-intro-python"],
  ["ml-intensive-tlf", "l02-numpy-pandas"],
  ["ml-intensive-tlf", "l03-ml-intro"],
  ["ml-intensive-tlf", "l04-linear-models"],
  ["ml-intensive-tlf", "l05-backprop"],
  ["building-ai-agents", "l01-intro-agents"],
  ["building-ai-agents", "l02-tools-mcp"],
];

// Pruning assets is only safe if every reference still resolves — check each
// <img>, each reveal background and each CSS background on every lesson, not a
// sample. Only same-origin URLs are asserted on: pruning can only ever break
// something we publish, and a deck that hotlinks a third-party image would
// otherwise make this suite fail on their downtime rather than on our bug.
for (const [cls, lesson] of LESSONS) {
  test(`assets resolve: ${cls}/${lesson}`, async ({ page }) => {
    test.slow();
    await page.goto(`/classes/${cls}/${lesson}/present.html`);
    await page.waitForFunction(() => (window as any).Reveal?.isReady?.(), { timeout: 60000 });

    const result = await page.evaluate(async () => {
      const bad: string[] = [];
      const mine = (u: string) => new URL(u, location.href).origin === location.origin;

      const imgs = Array.from(document.images);
      await Promise.all(imgs.map((i) => i.complete ? null : i.decode().catch(() => null)));
      for (const i of imgs) {
        if (!i.naturalWidth && mine(i.src)) bad.push(`img ${i.getAttribute("src")}`);
      }

      const urls = new Set<string>();
      document.querySelectorAll("[data-background-image], [data-background-video]")
        .forEach((el) => {
          const v = el.getAttribute("data-background-image") ||
                    el.getAttribute("data-background-video");
          if (v) urls.add(v);
        });

      // A slide background can live in the deck's own CSS instead of its
      // markup, where it is neither an <img> nor a data-background-* attribute.
      // Such a reference resolves against present.html — one directory below
      // the published assets — so a missing rewrite costs the slide its
      // picture and reports nothing.
      let css = 0;
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const bg = getComputedStyle(el).backgroundImage;
        if (!bg || bg === "none") continue;
        for (const m of bg.matchAll(/url\("?([^")]+)"?\)/g)) {
          if (!m[1].startsWith("data:")) { urls.add(m[1]); css++; }
        }
      }

      let checked = 0;
      for (const u of urls) {
        if (!mine(u)) continue;
        checked++;
        const r = await fetch(u, { method: "HEAD" });
        if (!r.ok) bad.push(`background ${u} → ${r.status}`);
      }
      return { bad, images: imgs.length, backgrounds: checked, css };
    });

    console.log(`${cls}/${lesson}: ${result.images} images, ` +
                `${result.backgrounds} backgrounds checked (${result.css} from CSS)`);
    expect(result.bad, `broken references in ${cls}/${lesson}`).toEqual([]);
  });
}
