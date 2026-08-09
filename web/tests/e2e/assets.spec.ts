import { test, expect } from "@playwright/test";

const LESSONS = ["l01-intro-python", "l02-numpy-pandas", "l03-ml-intro",
                 "l04-linear-models", "l05-backprop"];

// Pruning assets is only safe if every reference still resolves — check each
// <img> and each reveal background on every lesson, not a sample.
for (const lesson of LESSONS) {
  test(`assets resolve: ${lesson}`, async ({ page }) => {
    test.slow();
    await page.goto(`http://localhost:3000/classes/ml-intensive-tlf/${lesson}/present.html`);
    await page.waitForFunction(() => (window as any).Reveal?.isReady?.(), { timeout: 60000 });

    const broken = await page.evaluate(async () => {
      const bad: string[] = [];
      const imgs = Array.from(document.images);
      await Promise.all(imgs.map((i) => i.complete ? null : i.decode().catch(() => null)));
      for (const i of imgs) if (!i.naturalWidth) bad.push(`img ${i.getAttribute("src")}`);
      const urls = new Set<string>();
      document.querySelectorAll("[data-background-image], [data-background-video]")
        .forEach((el) => {
          const v = el.getAttribute("data-background-image") ||
                    el.getAttribute("data-background-video");
          if (v) urls.add(v);
        });
      for (const u of urls) {
        const r = await fetch(u, { method: "HEAD" });
        if (!r.ok) bad.push(`background ${u} → ${r.status}`);
      }
      return bad;
    });

    console.log(`${lesson}: ${await page.evaluate(() => document.images.length)} images checked`);
    expect(broken, `broken references in ${lesson}`).toEqual([]);
  });
}
