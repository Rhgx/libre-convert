import { getPresetById, PRESETS } from './presets'
import type { ConversionJob, ConversionPreset, ConversionPresetId } from '../types/conversion'

export function getFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex < 0) {
    return ''
  }

  return fileName.slice(lastDotIndex).toLowerCase()
}

export function normalizePdfName(fileName: string): string {
  const ext = getFileExtension(fileName)
  const base = ext ? fileName.slice(0, -ext.length) : fileName
  return `${base}.pdf`
}

export function detectPresetForFile(fileName: string): ConversionPreset | null {
  const extension = getFileExtension(fileName)
  return PRESETS.find((preset) => preset.extensions.includes(extension)) ?? null
}

export function getAcceptedFileTypes(): string {
  return PRESETS.flatMap((preset) => preset.extensions).join(',')
}

export function getSupportedExtensions(): string[] {
  return PRESETS.flatMap((preset) => preset.extensions)
}

export function buildInputPath(jobId: string, fileName: string): string {
  const extension = getFileExtension(fileName)
  return `/tmp/${jobId}${extension || '.bin'}`
}

export function buildOutputPath(jobId: string): string {
  return `/tmp/${jobId}.pdf`
}

export function validateFilesForAutoDetect(files: File[]) {
  const valid: Array<{ file: File; preset: ConversionPreset }> = []
  const invalid: Array<{ file: File; extension: string }> = []

  for (const file of files) {
    const preset = detectPresetForFile(file.name)
    if (preset) {
      valid.push({ file, preset })
      continue
    }

    invalid.push({ file, extension: getFileExtension(file.name) })
  }

  return { valid, invalid }
}

export function createConversionJob(file: File, presetId: ConversionPresetId): ConversionJob {
  const preset = getPresetById(presetId)
  return {
    id: crypto.randomUUID(),
    presetId,
    file,
    status: 'queued',
    statusLabel: `Queued for ${preset.label}`,
  }
}
