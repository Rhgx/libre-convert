const ZETA_RUNTIME_USED_KEY = 'libre-convert:zeta-runtime-used'
const ZETA_CDN_BASE_URLS = {
  free: 'https://cdn.zetaoffice.net/zetaoffice_latest/',
  business: 'https://business-cdn.zetaoffice.net/zetaoffice_latest/',
} as const

type WarmupOptions = {
  threadUrl: string
  wasmPkg: string
  zetaHelperUrl: string
  zetaJsUrl: string
}

let warmupScheduled = false

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function hasUsedZetaRuntimeBefore() {
  if (!canUseStorage()) {
    return false
  }

  try {
    return window.localStorage.getItem(ZETA_RUNTIME_USED_KEY) === '1'
  } catch {
    return false
  }
}

export function markZetaRuntimeUsed() {
  if (!canUseStorage()) {
    return
  }

  try {
    window.localStorage.setItem(ZETA_RUNTIME_USED_KEY, '1')
  } catch {
    // Ignore storage failures in private browsing or restricted contexts.
  }
}

export function resolveZetaWasmBaseUrl(wasmPkg: string): string {
  if (wasmPkg.startsWith('url:')) {
    return wasmPkg.slice(4)
  }

  return ZETA_CDN_BASE_URLS[wasmPkg as keyof typeof ZETA_CDN_BASE_URLS] ?? ZETA_CDN_BASE_URLS.free
}

export function getZetaRuntimeAssetUrls({ threadUrl, wasmPkg, zetaHelperUrl, zetaJsUrl }: WarmupOptions) {
  const wasmBaseUrl = resolveZetaWasmBaseUrl(wasmPkg)

  return [
    zetaHelperUrl,
    zetaJsUrl,
    threadUrl,
    new URL('soffice.js', wasmBaseUrl).toString(),
    new URL('soffice.wasm', wasmBaseUrl).toString(),
    new URL('soffice.data.js.metadata', wasmBaseUrl).toString(),
    new URL('soffice.data', wasmBaseUrl).toString(),
  ]
}

async function warmViaServiceWorker(urls: string[]) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const worker = navigator.serviceWorker.controller || registration.active || registration.waiting
    if (!worker) {
      return false
    }

    worker.postMessage({
      type: 'warm-zeta-assets',
      urls,
    })
    return true
  } catch {
    return false
  }
}

async function warmViaFetch(urls: string[]) {
  await Promise.all(
    urls.map(async (url) => {
      try {
        await fetch(url, {
          mode: 'cors',
          credentials: 'omit',
          cache: 'force-cache',
        })
      } catch {
        // Ignore warmup failures. Conversion will do the real request path.
      }
    }),
  )
}

export function scheduleZetaRuntimeWarmup(options: WarmupOptions) {
  if (warmupScheduled || typeof window === 'undefined' || !hasUsedZetaRuntimeBefore()) {
    return
  }

  warmupScheduled = true
  const urls = getZetaRuntimeAssetUrls(options)
  const runWarmup = async () => {
    const warmedByServiceWorker = await warmViaServiceWorker(urls)
    if (!warmedByServiceWorker) {
      await warmViaFetch(urls)
    }
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      void runWarmup()
    }, { timeout: 2000 })
    return
  }

  globalThis.setTimeout(() => {
    void runWarmup()
  }, 300)
}
