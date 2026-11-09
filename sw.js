// Offline support: keep the app's own files (and its fonts) cached so it opens with no signal.
// Bump CACHE whenever the app files change so phones drop the old copy.
const CACHE = "semester-v1";
const SHELL = [
  "./", "index.html", "styles.css", "app.js", "manifest.webmanifest",
  "icons/icon-32.png", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !isFont) return; // news feeds go straight to the network; the app keeps its own copy

  // Stale-while-revalidate: answer from the cache instantly, refresh it in the background.
  const network = fetch(e.request).then(async res => {
    if (res.ok || res.type === "opaque") (await caches.open(CACHE)).put(e.request, res.clone());
    return res;
  });
  e.respondWith(caches.match(e.request, { ignoreSearch: sameOrigin }).then(cached => cached || network));
  e.waitUntil(network.catch(() => {}));
});
