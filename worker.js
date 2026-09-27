// Cloudflare Worker — live PATH proxy for the flipboard (free tier is plenty).
//
// Setup (5 min, no CLI):
//   1. https://dash.cloudflare.com → Workers & Pages → Create Worker → Deploy.
//   2. Edit code → paste this file → Deploy.
//   3. Copy the workers.dev URL, then open your board once as:
//        https://ece818.github.io/path-flipboard/?live=https://<you>.workers.dev
//      The board saves it (localStorage) and uses it from then on.
//
// What it does: fetches PANYNJ server-side (no CORS issues there), caches
// for 15s at the edge, and serves JSON with Access-Control-Allow-Origin: *.

const UPSTREAM = 'https://www.panynj.gov/bin/portauthority/ridepath.json';

function withCors(res) {
  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }));
    }
    const cache = caches.default;
    const cacheKey = new Request('https://path-flipboard/ridepath.json', request);
    let res = await cache.match(cacheKey);
    if (!res) {
      const upstream = await fetch(`${UPSTREAM}?timeStamp=${Date.now()}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (PATH-Flipboard)', Accept: 'application/json' },
      });
      if (!upstream.ok) {
        return withCors(
          Response.json({ error: `upstream ${upstream.status}` }, { status: 502 }),
        );
      }
      res = new Response(await upstream.text(), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=15',
        },
      });
      ctx.waitUntil(cache.put(cacheKey, res.clone()));
    }
    return withCors(res);
  },
};
