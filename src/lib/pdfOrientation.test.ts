import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { applyPdfPageOrientation } from './pdfOrientation'

describe('pdfOrientation', () => {
  it('normalizes converted PDFs to vertical pages', async () => {
    const source = await PDFDocument.create()
    const sourcePage = source.addPage([900, 520])
    sourcePage.drawText('sample')
    const sourceBytes = await source.save()

    const oriented = await applyPdfPageOrientation(toArrayBuffer(sourceBytes), 'vertical')

    const output = await PDFDocument.load(oriented)
    const page = output.getPages()[0]
    expect(page?.getWidth()).toBeCloseTo(595.28, 1)
    expect(page?.getHeight()).toBeCloseTo(841.89, 1)
  })

  it('normalizes converted PDFs to horizontal pages', async () => {
    const source = await PDFDocument.create()
    const sourcePage = source.addPage([520, 900])
    sourcePage.drawText('sample')
    const sourceBytes = await source.save()

    const oriented = await applyPdfPageOrientation(toArrayBuffer(sourceBytes), 'horizontal')

    const output = await PDFDocument.load(oriented)
    const page = output.getPages()[0]
    expect(page?.getWidth()).toBeCloseTo(841.89, 1)
    expect(page?.getHeight()).toBeCloseTo(595.28, 1)
  })
})

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
