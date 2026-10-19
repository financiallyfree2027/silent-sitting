/* Service worker: keeps the app itself available offline.
 * The recordings live in a separate cache that the app fills when the person taps
 * "Download for offline use", so they survive app updates.
 * Bump CACHE_VERSION whenever you change any app file. */
const CACHE_VERSION = "v9";
const SHELL_CACHE = "sitting-shell-" + CACHE_VERSION;
const AUDIO_CACHE = "sitting-audio-v1";
const SHELL = [
  "./", "index.html", "styles.css", "app.js", "clips.json", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
  "fonts/figtree-latin-400-normal.woff2", "fonts/figtree-latin-500-normal.woff2",
  "fonts/figtree-latin-600-normal.woff2", "fonts/figtree-latin-700-normal.woff2",
  "fonts/tiro-devanagari-hindi-devanagari-400-normal.woff2", "fonts/tiro-devanagari-hindi-latin-400-normal.woff2",
  "fonts/jetbrains-mono-latin-400-normal.woff2", "fonts/jetbrains-mono-latin-500-normal.woff2",
  "learn.html", "vendor/gsap.min.js",
  "fonts/figtree-latin-800-normal.woff2", "fonts/caveat-latin-500-normal.woff2", "fonts/caveat-latin-700-normal.woff2",
  "fonts/bricolage-grotesque-latin-500-normal.woff2", "fonts/bricolage-grotesque-latin-700-normal.woff2",
  "fonts/bricolage-grotesque-latin-800-normal.woff2",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("sitting-shell-") && k !== SHELL_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Recordings: saved copy if downloaded, otherwise stream from the site.
  if (url.pathname.includes("/audio/")) {
    e.respondWith(caches.open(AUDIO_CACHE).then(c => c.match(req)).then(hit => hit || fetch(req)));
    return;
  }

  // Cut list: try the network so updated clips are picked up, fall back offline.
  if (url.pathname.endsWith("/clips.json")) {
    e.respondWith(
      fetch(req).then(res => { const copy = res.clone(); caches.open(SHELL_CACHE).then(c => c.put(req, copy)); return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  // App shell: answer from cache instantly, refresh it in the background.
  e.respondWith(
    caches.open(SHELL_CACHE).then(async cache => {
      // a page request is answered with that page (learn.html opens in the menu's view); the bare address gets index.html
      const nav = req.mode === "navigate";
      const key = nav && (url.pathname.endsWith("/") || !/\.html$/.test(url.pathname)) ? "index.html" : req;
      const hit = await cache.match(key, { ignoreSearch: true });
      const net = fetch(req).then(res => { if (res.ok) cache.put(key, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || new Response("Offline", { status: 503 });
    })
  );
});
