import { describe, expect, it } from 'vitest'
import { resolveBundledAssetUrl, resolvePublicAssetUrl } from './assetUrls'

describe('assetUrls', () => {
  it('resolves public assets against the app base path in production', () => {
    const url = resolvePublicAssetUrl(
      'vendor/zetajs/1.2.0/zetaHelper.js',
      '/libre-convert/',
      'https://rhgx.github.io/libre-convert/assets/libreOffice.thread-B9o6ADCl.js',
    )

    expect(url).toBe('https://rhgx.github.io/libre-convert/vendor/zetajs/1.2.0/zetaHelper.js')
  })

  it('resolves public assets against the dev server root', () => {
    const url = resolvePublicAssetUrl(
      '/vendor/zetajs/1.2.0/zetaHelper.js',
      '/',
      'http://localhost:5173/src/workers/libreOffice.thread.ts',
    )

    expect(url).toBe('http://localhost:5173/vendor/zetajs/1.2.0/zetaHelper.js')
  })

  it('resolves bundled asset URLs relative to the importing module', () => {
    const url = resolveBundledAssetUrl(
      '/libre-convert/assets/libreOffice.thread-B9o6ADCl.js',
      'https://rhgx.github.io/libre-convert/assets/index-BkL6uUZw.js',
    )

    expect(url).toBe('https://rhgx.github.io/libre-convert/assets/libreOffice.thread-B9o6ADCl.js')
  })
})
