import { describe, expect, it } from 'vitest'
import { buildImagePdfDocument } from './imagePdf'

describe('imagePdf', () => {
  it('builds a portrait pdf page for vertical images', () => {
    const pdf = buildImagePdfDocument({
      imageWidth: 1200,
      imageHeight: 1600,
      jpegData: new Uint8Array([255, 216, 255, 217]),
      orientation: 'vertical',
    })

    const output = new TextDecoder().decode(pdf)
    expect(output.startsWith('%PDF-1.4')).toBe(true)
    expect(output).toContain('/MediaBox [0 0 595.28 841.89]')
  })

  it('builds a landscape pdf page for horizontal images', () => {
    const pdf = buildImagePdfDocument({
      imageWidth: 1600,
      imageHeight: 1200,
      jpegData: new Uint8Array([255, 216, 255, 217]),
      orientation: 'horizontal',
    })

    const output = new TextDecoder().decode(pdf)
    expect(output).toContain('/MediaBox [0 0 841.89 595.28]')
  })
})
