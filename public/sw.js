// Adds the cross-origin isolation headers LibreOffice WASM needs (static hosts can't set them) and
// caches the app and the LibreOffice runtime so the converter keeps working offline.
const APP_CACHE = 'libre-convert-app'
// Name kept from the first release so returning visitors keep the runtime they already downloaded.
const RUNTIME_CACHE = 'libre-convert-zeta-assets-v1'
const RUNTIME_ORIGIN = 'https://cdn.zetaoffice.net'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name !== APP_CACHE && name !== RUNTIME_CACHE) {
          await caches.delete(name)
        }
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || (request.cache === 'only-if-cached' && request.mode !== 'same-origin')) {
    return
  }

  const url = new URL(request.url)
  if (url.origin === RUNTIME_ORIGIN) {
    event.respondWith(runtimeAsset(event, request))
  } else if (url.origin === self.location.origin) {
    event.respondWith(appAsset(event, request))
  }
})

// The runtime (about 50 MB) is only published as "latest", so it is cached once and never revalidated.
// That also keeps it matched to the vendored zeta.js. Rename RUNTIME_CACHE to force a fresh download.
async function runtimeAsset(event, request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(request.url)
  if (cached) {
    return cached
  }

  // Always fetch in CORS mode (the CDN allows any origin): an opaque response cached for the page's
  // <script> tag would be rejected by importScripts in the LibreOffice thread.
  const response = await fetch(request.url, { mode: 'cors', credentials: 'omit' })
  if (response.ok) {
    event.waitUntil(cache.put(request.url, response.clone()))
  }
  return response
}

// Network first so new deploys show up right away; the cache is the offline fallback.
// ponytail: old hashed assets pile up in APP_CACHE across deploys. Prune by age if it ever grows noticeably.
async function appAsset(event, request) {
  const cache = await caches.open(APP_CACHE)
  let response

  try {
    response = await fetch(request)
    if (response.ok) {
      event.waitUntil(cache.put(request, response.clone()))
    }
  } catch (error) {
    response =
      (await cache.match(request, { ignoreSearch: request.mode === 'navigate' })) ??
      (request.mode === 'navigate' ? await cache.match(self.registration.scope) : undefined)
    if (!response) {
      throw error
    }
  }

  const headers = new Headers(response.headers)
  // The body is already decoded at this point.
  headers.delete('Content-Encoding')
  headers.delete('Content-Length')
  headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp')

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}
