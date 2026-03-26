const V = "v3";
const CACHE = ["/", "index.html", "app.js", "manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(ks =>
      Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.url.includes("supabase.co")) return;
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && url.origin === self.location.origin) {
        caches.open(V).then(c => c.put(e.request, res.clone()));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
