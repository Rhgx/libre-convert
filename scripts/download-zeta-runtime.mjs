import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RUNTIME_BASE_URL = process.env.ZETA_RUNTIME_BASE_URL || 'https://cdn.zetaoffice.net/zetaoffice_latest/'
const RUNTIME_FILES = ['soffice.js', 'soffice.wasm', 'soffice.data.js.metadata', 'soffice.data']
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const outputDir = path.join(projectRoot, 'public', 'vendor', 'zetaoffice', 'latest')

await mkdir(outputDir, { recursive: true })

for (const fileName of RUNTIME_FILES) {
  const outputPath = path.join(outputDir, fileName)

  if (await fileExists(outputPath)) {
    console.log(`Skipping ${fileName}; already present`)
    continue
  }

  const sourceUrl = new URL(fileName, RUNTIME_BASE_URL)
  console.log(`Downloading ${sourceUrl}`)
  const response = await fetch(sourceUrl)

  if (!response.ok) {
    throw new Error(`Failed to download ${sourceUrl}: ${response.status} ${response.statusText}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(outputPath, buffer)
}

async function fileExists(targetPath) {
  try {
    await stat(targetPath)
    return true
  } catch {
    return false
  }
}
