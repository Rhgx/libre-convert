import { describe, expect, it } from 'vitest'
import { getZetaRuntimeAssetUrls, resolveZetaWasmBaseUrl } from './zetaRuntimeCache'

describe('zetaRuntimeCache', () => {
  it('resolves the default ZetaOffice CDN URL', () => {
    expect(resolveZetaWasmBaseUrl('free')).toBe('https://cdn.zetaoffice.net/zetaoffice_latest/')
  })

  it('resolves custom ZetaOffice URLs', () => {
    expect(resolveZetaWasmBaseUrl('url:https://example.com/lowa/')).toBe('https://example.com/lowa/')
  })

  it('builds the full runtime asset list', () => {
    expect(
      getZetaRuntimeAssetUrls({
        wasmPkg: 'free',
        zetaHelperUrl: 'https://rhgx.github.io/libre-convert/vendor/zetajs/1.2.0/zetaHelper.js',
        zetaJsUrl: 'https://rhgx.github.io/libre-convert/vendor/zetajs/1.2.0/zeta.js',
        threadUrl: 'https://rhgx.github.io/libre-convert/assets/libreOffice.thread.js',
      }),
    ).toEqual([
      'https://rhgx.github.io/libre-convert/vendor/zetajs/1.2.0/zetaHelper.js',
      'https://rhgx.github.io/libre-convert/vendor/zetajs/1.2.0/zeta.js',
      'https://rhgx.github.io/libre-convert/assets/libreOffice.thread.js',
      'https://cdn.zetaoffice.net/zetaoffice_latest/soffice.js',
      'https://cdn.zetaoffice.net/zetaoffice_latest/soffice.wasm',
      'https://cdn.zetaoffice.net/zetaoffice_latest/soffice.data.js.metadata',
      'https://cdn.zetaoffice.net/zetaoffice_latest/soffice.data',
    ])
  })
})
