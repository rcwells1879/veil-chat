const CACHE_VERSION = Date.now();
const CACHE_NAME = `veilchat-v${CACHE_VERSION}`;

const PRECACHE = [
  "/veilchat/",
  "/veilchat/index.html",
  "/veilchat/manifest.json",
  "/veilchat/assets/veilchat-aether-bg.png",
  "/veilchat/icons/icon-192x192.png",
  "/veilchat/icons/icon-512x512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          PRECACHE.map((asset) =>
            fetch(asset)
              .then((response) => (response.ok ? cache.put(asset, response) : undefined))
              .catch(() => undefined)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("veilchat-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/veilchat/assets/") || url.pathname.startsWith("/veilchat/icons/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match("/veilchat/index.html")));
});
