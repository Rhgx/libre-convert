export function resolvePublicAssetUrl(assetPath: string, basePath: string, moduleUrl: string): string {
  const normalizedAssetPath = assetPath.replace(/^\/+/, '')
  const appBaseUrl = new URL(basePath, moduleUrl)
  return new URL(normalizedAssetPath, appBaseUrl).toString()
}

export function resolveBundledAssetUrl(assetUrl: string, moduleUrl: string): string {
  return new URL(assetUrl, moduleUrl).toString()
}
