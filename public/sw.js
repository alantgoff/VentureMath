// Stale-while-revalidate over same-origin GETs. The built asset filenames are
// hashed and unknown ahead of time, so rather than precaching a manifest we
// cache whatever the app actually fetches and serve it back when offline.
const CACHE = 'venturemath-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.add(new Request('./', { cache: 'reload' }))))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  // Navigations fall back to the cached shell so a cold launch works offline.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put('./', res.clone()))
          return res
        })
        .catch(() => caches.match('./').then((r) => r || caches.match(request))),
    )
    return
  }

  e.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()))
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
