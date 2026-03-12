import { PDFDocument } from 'pdf-lib'
import type { PageOrientation } from '../types/conversion'

const PDF_PAGE_SIZE = {
  vertical: { width: 595.28, height: 841.89 },
  horizontal: { width: 841.89, height: 595.28 },
} as const

const PDF_MARGIN = 18

export async function applyPdfPageOrientation(inputPdf: ArrayBuffer, orientation: PageOrientation): Promise<ArrayBuffer> {
  const sourceDocument = await PDFDocument.load(inputPdf)
  const orientedDocument = await PDFDocument.create()
  const targetPage = PDF_PAGE_SIZE[orientation]

  for (const sourcePage of sourceDocument.getPages()) {
    const embeddedPage = await orientedDocument.embedPage(sourcePage)
    const page = orientedDocument.addPage([targetPage.width, targetPage.height])

    const maxWidth = targetPage.width - PDF_MARGIN * 2
    const maxHeight = targetPage.height - PDF_MARGIN * 2
    const scale = Math.min(maxWidth / embeddedPage.width, maxHeight / embeddedPage.height)
    const drawWidth = embeddedPage.width * scale
    const drawHeight = embeddedPage.height * scale

    page.drawPage(embeddedPage, {
      width: drawWidth,
      height: drawHeight,
      x: (targetPage.width - drawWidth) / 2,
      y: (targetPage.height - drawHeight) / 2,
    })
  }

  const bytes = await orientedDocument.save()
  return toArrayBuffer(bytes)
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
