/* eslint-disable no-restricted-globals */
const ZETA_ASSET_CACHE = 'libre-convert-zeta-assets-v1'
const ZETA_ASSET_SUFFIXES = ['soffice.js', 'soffice.wasm', 'soffice.data.js.metadata', 'soffice.data', 'zeta.js', 'zetaHelper.js']

function isZetaAssetRequest(requestUrl) {
  return ZETA_ASSET_SUFFIXES.some((suffix) => requestUrl.pathname.endsWith(`/${suffix}`))
}

async function fetchWithIsolationHeaders(request) {
  const response = await fetch(request)
  if (response.status === 0) {
    return response
  }

  const headers = new Headers(response.headers)
  headers.delete('Content-Encoding')
  headers.delete('Content-Length')
  headers.delete('Transfer-Encoding')
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
  headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

async function cacheZetaAsset(request, cache) {
  const response = await fetchWithIsolationHeaders(request)
  if (response.ok) {
    await cache.put(request, response.clone())
  }

  return response
}

async function respondWithCachedZetaAsset(request) {
  const cache = await caches.open(ZETA_ASSET_CACHE)
  const cached = await cache.match(request)

  if (cached) {
    void cacheZetaAsset(request, cache)
    return cached
  }

  return cacheZetaAsset(request, cache)
}

async function warmZetaAssets(urls) {
  const cache = await caches.open(ZETA_ASSET_CACHE)
  await Promise.all(
    urls.map(async (url) => {
      const request = new Request(url, {
        credentials: 'omit',
        mode: 'cors',
      })

      if (await cache.match(request)) {
        return
      }

      try {
        await cacheZetaAsset(request, cache)
      } catch (error) {
        console.warn('Zeta asset warmup failed', url, error)
      }
    }),
  )
}

if (typeof window === 'undefined') {
  self.addEventListener('install', () => {
    self.skipWaiting()
  })

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      Promise.all([
        self.clients.claim(),
        caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames
              .filter((cacheName) => cacheName.startsWith('libre-convert-zeta-assets-') && cacheName !== ZETA_ASSET_CACHE)
              .map((cacheName) => caches.delete(cacheName)),
          )
        }),
      ]),
    )
  })

  self.addEventListener('message', (event) => {
    if (event.data?.type === 'warm-zeta-assets') {
      event.waitUntil(warmZetaAssets(event.data.urls || []))
      return
    }

    if (event.data?.type !== 'deregister') {
      return
    }

    event.waitUntil(
      self.registration.unregister().then(() => {
        return self.clients.matchAll().then((clients) => {
          for (const client of clients) {
            client.navigate(client.url)
          }
        })
      }),
    )
  })

  self.addEventListener('fetch', (event) => {
    const request = event.request

    if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
      return
    }

    const requestUrl = new URL(request.url)
    if (request.method === 'GET' && isZetaAssetRequest(requestUrl)) {
      event.respondWith(respondWithCachedZetaAsset(request))
      return
    }

    event.respondWith(
      fetchWithIsolationHeaders(request)
        .catch((error) => {
          console.error('COI service worker fetch failed', error)
          throw error
        }),
    )
  })
} else {
  ;(() => {
    const serviceWorker = navigator.serviceWorker

    if (window.crossOriginIsolated || !window.isSecureContext || !serviceWorker) {
      return
    }

    serviceWorker
      .register('./coi-serviceworker.js')
      .then((registration) => {
        if (registration.active && !serviceWorker.controller) {
          window.location.reload()
          return
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing

          if (!installing) {
            return
          }

          installing.addEventListener('statechange', () => {
            if (installing.state === 'activated') {
              window.location.reload()
            }
          })
        })

        if (registration.waiting) {
          window.location.reload()
        }
      })
      .catch((error) => {
        console.error('COI service worker registration failed', error)
      })
  })()
}
