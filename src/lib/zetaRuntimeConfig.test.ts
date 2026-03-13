import { describe, expect, it } from 'vitest'
import { resolveZetaWasmPkg } from './zetaRuntimeConfig'

describe('zetaRuntimeConfig', () => {
  it('defaults to the hosted free runtime', () => {
    expect(resolveZetaWasmPkg(undefined, '/libre-convert/', 'https://rhgx.github.io/libre-convert/assets/index.js')).toBe('free')
  })

  it('maps self-hosted mode to a public runtime URL', () => {
    expect(resolveZetaWasmPkg('self-hosted', '/libre-convert/', 'https://rhgx.github.io/libre-convert/assets/index.js')).toBe(
      'url:https://rhgx.github.io/libre-convert/vendor/zetaoffice/latest/',
    )
  })

  it('leaves explicit runtime URLs untouched', () => {
    expect(
      resolveZetaWasmPkg('url:https://example.com/runtime/', '/', 'http://localhost:5173/src/main.tsx'),
    ).toBe('url:https://example.com/runtime/')
  })
})
