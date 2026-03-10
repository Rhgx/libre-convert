/* eslint-disable no-restricted-globals */
if (typeof window === 'undefined') {
  self.addEventListener('install', () => {
    self.skipWaiting()
  })

  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim())
  })

  self.addEventListener('message', (event) => {
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

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 0) {
            return response
          }

          const headers = new Headers(response.headers)
          headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
          headers.set('Cross-Origin-Opener-Policy', 'same-origin')
          headers.set('Cross-Origin-Resource-Policy', 'cross-origin')

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          })
        })
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
