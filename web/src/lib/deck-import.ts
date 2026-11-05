import { prisma } from "@/lib/db";
import { findLesson, getAccess, getClassMeta } from "@/lib/classes";
import { sanitizeDeck, pyConfig } from "@/lib/deck-sanitize";
import { inlineClassStyles, readPyToml, slidesOfPage, topLevelSections, type DeckRef } from "@/lib/deck-convert";
import { STUDIO_LIMITS, sniffImage } from "@/lib/studio";

/* Read one of this site's lessons and turn it into a studio deck for a course:
 * its slides, its images and the data files its editors open, all moved into
 * the course's own assets, since a studio deck may only show those.
 *
 * Only lessons the teacher could open anyway: a repo lesson is read from its
 * published present.html on this origin (the paths are built here from slugs,
 * never taken from the message, so nothing else can be fetched), a studio
 * lesson straight from the database. A draft the teacher cannot see is "no
 * such lesson", exactly as its page would say.
 *
 * Assets are written as they are found, before anyone presses Save: that is
 * how uploading an image works too. Re-importing reuses what is already there
 * (same name, size and type), so trying again costs no storage. */

export type ImportedDeck = {
  ok: true;
  title: string;
  deck: string;
  sections: string[];
  images: number;
  files: number;
  /** CSS rules that had no inline form and were left behind. */
  dropped: string[];
};
type Fail = { ok: false; error: string };

const MAX_ASSETS = 80;
const DATA_EXT: Record<string, string> = {
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  txt: "text/plain",
};

export async function importLessonDeck(
  ref: DeckRef,
  opts: { origin: string; targetClassId: string },
): Promise<ImportedDeck | Fail> {
  const missing: Fail = { ok: false, error: `Could not find the lesson at ${ref.url}.` };
  const [meta, access] = await Promise.all([getClassMeta(ref.classSlug), getAccess(ref.classSlug)]);
  const lesson = meta ? findLesson(meta, ref.lessonSlug) : null;
  if (!meta || !lesson || !access.visible) return missing;

  const store = new AssetStore(opts.targetClassId);
  let html: string;
  let dropped: string[] = [];

  if (access.studio) {
    const row = await prisma.studioLesson.findUnique({
      where: { classId_slug: { classId: access.classRow!.id, slug: ref.lessonSlug } },
      select: { deck: true },
    });
    if (!row) return missing;
    html = row.deck;
    if (access.classRow!.id !== opts.targetClassId) {
      // Another course's assets: copy the rows, so deleting that course
      // cannot take this one's pictures with it.
      const ids = [...new Set([...html.matchAll(/\/api\/studio\/assets\/([a-z0-9]{20,32})/g)].map((m) => m[1]))];
      const rows = await prisma.studioAsset.findMany({
        where: { id: { in: ids }, classId: access.classRow!.id },
        select: { id: true, name: true, mime: true, bytes: true },
      });
      const map = new Map<string, string>();
      for (const r of rows) {
        const got = await store.put(r.name, r.mime, Buffer.from(r.bytes));
        if (!got.ok) return got;
        map.set(r.id, got.id);
      }
      html = html.replace(/\/api\/studio\/assets\/([a-z0-9]{20,32})/g, (m, id: string) =>
        map.has(id) ? `/api/studio/assets/${map.get(id)}` : m,
      );
    }
  } else {
    const base = `${opts.origin}/classes/${ref.classSlug}`;
    const page = await fetchOk(`${base}/${ref.lessonSlug}/present.html`);
    const parts = page ? slidesOfPage(page.toString("utf8")) : null;
    if (!parts) return missing;
    const inlined = inlineClassStyles(parts.slides, parts.css);
    html = inlined.html;
    dropped = inlined.dropped;

    const assetPath = `/classes/${ref.classSlug}/assets/`;
    const NAME = "[A-Za-z0-9_][A-Za-z0-9_.-]{0,120}";

    // Editors whose config is a toml file: read it, move its data files, and
    // write the config inline — the only form a studio deck keeps.
    const tomlRe = new RegExp(`config\\s*=\\s*(["'])${assetPath.replace(/[/.]/g, "\\$&")}(${NAME}\\.toml)\\1`, "g");
    const configs = new Map<string, string | null>();
    for (const [, , toml] of html.matchAll(tomlRe)) {
      if (configs.has(toml)) continue;
      const text = await fetchOk(`${base}/assets/${toml}`);
      if (!text) {
        configs.set(toml, null);
        continue;
      }
      const cfg = readPyToml(text.toString("utf8"));
      const files: Record<string, string> = {};
      for (const f of cfg.files) {
        if (!new RegExp(`^${NAME}$`).test(f.src)) continue; // only files beside the toml
        const bytes = await fetchOk(`${base}/assets/${f.src}`);
        if (!bytes) return { ok: false, error: `The data file ${f.src} of ${ref.url} could not be read.` };
        const mime = DATA_EXT[f.src.split(".").pop()!.toLowerCase()] ?? "text/plain";
        if (!isText(bytes))
          return { ok: false, error: `${f.src} is not a text file, and only text data files can be copied.` };
        const got = await store.put(f.src, mime, bytes);
        if (!got.ok) return got;
        files[`/api/studio/assets/${got.id}`] = f.dest;
      }
      configs.set(toml, pyConfig(`config='${JSON.stringify({ packages: cfg.packages, files })}'`));
    }
    html = html.replace(tomlRe, (_m, _q, toml: string) => {
      const c = configs.get(toml);
      return c ? `config='${c}'` : "";
    });

    // Images: <img src>, reveal backgrounds, url() in style attributes.
    const imgRe = new RegExp(`${assetPath.replace(/[/.]/g, "\\$&")}(${NAME})`, "g");
    const names = [...new Set([...html.matchAll(imgRe)].map((m) => m[1]))].filter(
      (n) => !/\.(toml|csv|json|txt|py)$/i.test(n),
    );
    const ids = new Map<string, string>();
    for (const n of names) {
      const bytes = await fetchOk(`${base}/assets/${n}`);
      const mime = bytes ? sniffImage(bytes) : null;
      if (!bytes || !mime) continue; // left as is; the sanitizer drops the reference
      const got = await store.put(n, mime, bytes);
      if (!got.ok) return got;
      ids.set(n, got.id);
    }
    html = html.replace(imgRe, (m, n: string) => (ids.has(n) ? `/api/studio/assets/${ids.get(n)}` : m));
  }

  const deck = sanitizeDeck(html);
  if (Buffer.byteLength(deck) > STUDIO_LIMITS.deckBytes) {
    return { ok: false, error: `${ref.url} is larger than a studio lesson can hold.` };
  }
  return {
    ok: true,
    title: lesson.title,
    deck,
    sections: topLevelSections(deck),
    images: store.images,
    files: store.files,
    dropped,
  };
}

async function fetchOk(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > STUDIO_LIMITS.assetBytes) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > STUDIO_LIMITS.assetBytes ? null : buf;
  } catch {
    return null;
  }
}

function isText(b: Buffer): boolean {
  if (b.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(b);
    return true;
  } catch {
    return false;
  }
}

/** The course's assets, written once each and counted against its quota. */
class AssetStore {
  images = 0;
  files = 0;
  private count = 0;
  private used: number | null = null;
  constructor(private classId: string) {}

  async put(name: string, mime: string, bytes: Buffer): Promise<{ ok: true; id: string } | Fail> {
    if (++this.count > MAX_ASSETS)
      return { ok: false, error: `That lesson has more than ${MAX_ASSETS} files to copy.` };
    if (bytes.length > STUDIO_LIMITS.assetBytes)
      return { ok: false, error: `${name} is over ${STUDIO_LIMITS.assetBytes / 1024 / 1024} MB.` };
    if (mime.startsWith("image/")) this.images++;
    else this.files++;
    const have = await prisma.studioAsset.findFirst({
      where: { classId: this.classId, name, size: bytes.length, mime },
      select: { id: true },
    });
    if (have) return { ok: true, id: have.id };
    if (this.used === null) {
      const agg = await prisma.studioAsset.aggregate({ where: { classId: this.classId }, _sum: { size: true } });
      this.used = agg._sum.size ?? 0;
    }
    if (this.used + bytes.length > STUDIO_LIMITS.assetsPerCourse) {
      return { ok: false, error: "This course has used its image storage, so the slides' pictures cannot be copied." };
    }
    this.used += bytes.length;
    const row = await prisma.studioAsset.create({
      data: { classId: this.classId, name: name.slice(0, 200), mime, bytes: new Uint8Array(bytes), size: bytes.length },
      select: { id: true },
    });
    return { ok: true, id: row.id };
  }
}
