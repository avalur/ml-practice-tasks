/* The two checks every cookie-authenticated mutation needs, in one place.
 *
 * They were copy-pasted per route before, which is how the class routes ended up
 * without an origin check at all and how a JSON body of `null` turned into a 500
 * instead of a 400. */

/** The origin this deployment answers on, for links that leave the server.
 *
 * Never derive an emailed link from the request: Auth.js runs with
 * `trustHost: true`, so `req.url` carries whatever Host arrived, and a reset
 * link built from it can be pointed at somebody else's domain. Configure
 * `SITE_URL` in production; the request is the fallback for local work, where
 * the host is whatever the developer typed. */
export function siteOrigin(req: Request): string {
  const configured = process.env.SITE_URL ?? process.env.AUTH_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  return new URL(req.url).origin;
}

/* Requests here carry the session cookie, and SameSite=Lax still allows a
 * cross-site POST from a form. So check the origin: these endpoints change
 * passwords, create sessions and enroll students, and Auth.js's own CSRF token
 * does not cover routes it does not serve. */
export function crossSite(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false; // a same-origin fetch may omit it; no cookie-less risk
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto =
    req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  try {
    const sent = new URL(origin);
    // Scheme included: http://example.com and https://example.com are different
    // origins, and comparing only the host would accept the plain-http one.
    return sent.host !== host || sent.protocol.replace(":", "") !== proto;
  } catch {
    return true;
  }
}

/* ------------------------------------------------------------ rate limiting */

/* A sliding window per IP, in memory.
 *
 * Deliberately best-effort. It exists because the anonymous endpoints do real
 * work per request — one scrypt (~16 MB, ~100 ms) for login and register, one
 * outgoing email for forgot-password — and the account lockout cannot help
 * there: it needs an account, and an attacker rotating invented addresses never
 * touches the same one twice. This makes a flood from one source expensive
 * without a Redis dependency.
 *
 * What it is not: serverless runs many instances and each keeps its own map, so
 * the real limit is this one times however many are warm, and a cold start
 * forgets everything. Anything stronger belongs in front of the app.
 *
 * The numbers the callers pass are sized for a whole classroom behind one NAT
 * address registering or signing in at the start of a lesson — that is normal
 * traffic here, and locking it out would be a worse failure than the flood. */
const hits = new Map<string, number[]>();

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  // The left-most entry is the client; the rest were added by proxies.
  return (forwarded?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

/** True when this IP has already had `limit` goes at `bucket` in the window. */
export function rateLimited(
  req: Request,
  bucket: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const key = `${bucket}:${clientIp(req)}`;
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  // Cheap upkeep: without it the map grows one entry per address seen.
  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (times.every((t) => t <= now - windowMs)) hits.delete(k);
    }
  }
  return false;
}

/** The request body as an object, or null for anything else — no body, invalid
 *  JSON, or a valid JSON scalar such as `null`, which would otherwise throw on
 *  the first property read and answer 500. */
export async function jsonBody(req: Request): Promise<Record<string, unknown> | null> {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return null;
  }
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}
