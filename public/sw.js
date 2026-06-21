// Bump this whenever the caching strategy changes — `activate` purges every
// cache that isn't the current one, so old/over-eager entries get cleared.
const CACHE_NAME = "summit-v3";
const PRECACHE_URLS = ["/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Summit Lakeside", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});

// Static, effectively-immutable assets: Next.js hashes /_next/static/* by
// content, and our icons/fonts/images change rarely. These are safe to serve
// from cache instantly.
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Don't intercept navigations — they may produce opaque-redirect responses
  // (e.g. /q/[code] QR resolver) that can't be cached or re-served safely.
  if (req.mode === "navigate") return;

  const url = new URL(req.url);

  // Leave cross-origin requests (Supabase, Stripe, Google, CDNs) to the browser.
  if (url.origin !== self.location.origin) return;

  // Dynamic requests (API routes, RSC/data fetches, HTML) are NOT cached —
  // serving them stale risks showing old messages, bookings, etc. Let them go
  // straight to the network so data is always fresh.
  if (!isStaticAsset(url)) return;

  // Cache-first with a background refresh: return the cached copy instantly,
  // and quietly update the cache from the network for next time.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch((err) => {
          if (cached) return cached;
          throw err;
        });
      return cached || network;
    })
  );
});
