import { resolvePublicAssetUrl } from './assetUrls'

const SELF_HOSTED_WASM_PATH = 'vendor/zetaoffice/latest/'

export function resolveZetaWasmPkg(configuredValue: string | undefined, basePath: string, moduleUrl: string): string {
  if (!configuredValue) {
    return 'free'
  }

  if (configuredValue === 'self-hosted') {
    return `url:${resolvePublicAssetUrl(SELF_HOSTED_WASM_PATH, basePath, moduleUrl)}`
  }

  return configuredValue
}
