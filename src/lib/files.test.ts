import { describe, expect, it } from 'vitest'
import {
  buildInputPath,
  buildOutputPath,
  createConversionJob,
  detectPresetForFile,
  normalizePdfName,
  validateFilesForAutoDetect,
} from './files'

describe('file helpers', () => {
  it('normalizes output names to pdf', () => {
    expect(normalizePdfName('proposal.docx')).toBe('proposal.pdf')
    expect(normalizePdfName('deck')).toBe('deck.pdf')
  })

  it('builds stable temp paths', () => {
    expect(buildInputPath('job-1', 'report.xlsx')).toBe('/tmp/job-1.xlsx')
    expect(buildOutputPath('job-1')).toBe('/tmp/job-1.pdf')
  })

  it('detects the correct preset from the file extension', () => {
    expect(detectPresetForFile('memo.docx')?.id).toBe('word-to-pdf')
    expect(detectPresetForFile('sheet.xlsx')?.id).toBe('excel-to-pdf')
    expect(detectPresetForFile('deck.pptx')?.id).toBe('powerpoint-to-pdf')
    expect(detectPresetForFile('photo.png')?.id).toBe('image-to-pdf')
    expect(detectPresetForFile('archive.zip')).toBeNull()
  })

  it('validates files through auto-detect', () => {
    const files = [
      new File(['a'], 'memo.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      new File(['b'], 'table.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      new File(['c'], 'photo.png', { type: 'image/png' }),
      new File(['d'], 'archive.zip', { type: 'application/zip' }),
    ]

    const result = validateFilesForAutoDetect(files)

    expect(result.valid).toHaveLength(3)
    expect(result.invalid).toHaveLength(1)
    expect(result.valid[0]?.preset.id).toBe('word-to-pdf')
    expect(result.valid[1]?.preset.id).toBe('excel-to-pdf')
    expect(result.valid[2]?.preset.id).toBe('image-to-pdf')
    expect(result.invalid[0]?.file.name).toBe('archive.zip')
  })

  it('stores image orientation on image jobs', () => {
    const job = createConversionJob(new File(['pixels'], 'photo.png', { type: 'image/png' }), 'image-to-pdf', {
      imageOrientation: 'horizontal',
    })

    expect(job.imageOrientation).toBe('horizontal')
  })
})
