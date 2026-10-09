// PDF building and reshaping. Loaded on demand so pdf-lib stays out of the initial bundle.
import { PDFDocument, type PDFImage } from 'pdf-lib'
import type { Layout } from './formats'

type Sheet = [width: number, height: number]

const A4: Sheet = [595.28, 841.89]
const MARGIN = 36
const PX_TO_PT = 0.75 // CSS pixels are 1/96 inch, PDF points 1/72 inch.

export async function imageToPdf(file: File, layout: Layout): Promise<Blob> {
  const doc = await PDFDocument.create()
  const image = await embedImage(doc, file)

  if (layout === 'original') {
    const width = image.width * PX_TO_PT
    const height = image.height * PX_TO_PT
    doc.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height })
  } else {
    const sheet = a4(layout)
    doc.addPage(sheet).drawImage(image, fit(image.width, image.height, sheet))
  }

  return save(doc)
}

// Scales every page onto A4 in the given orientation. Used for slides and drawings, which can't be re-paginated.
export async function fitPages(pdf: Uint8Array, layout: Exclude<Layout, 'original'>): Promise<Blob> {
  const source = await PDFDocument.load(pdf)
  const doc = await PDFDocument.create()
  const sheet = a4(layout)

  for (const page of await doc.embedPages(source.getPages())) {
    doc.addPage(sheet).drawPage(page, fit(page.width, page.height, sheet))
  }

  return save(doc)
}

export async function mergePdfs(files: Blob[]): Promise<Blob> {
  const doc = await PDFDocument.create()

  for (const file of files) {
    const source = await PDFDocument.load(await file.arrayBuffer())
    for (const page of await doc.copyPages(source, source.getPageIndices())) {
      doc.addPage(page)
    }
  }

  return save(doc)
}

// EXIF orientation of a JPEG (1 = upright), so rotated phone photos can be re-rendered upright.
export function jpegOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  try {
    for (let offset = 2; offset + 4 <= view.byteLength; offset += 2 + view.getUint16(offset + 2)) {
      const marker = view.getUint16(offset)
      // Start of image data, or not a marker at all: no EXIF block.
      if (marker === 0xffda || (marker & 0xff00) !== 0xff00) {
        return 1
      }

      // APP1 segment starting with "Exif".
      if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) {
        const tiff = offset + 10
        const little = view.getUint16(tiff) === 0x4949
        const ifd = tiff + view.getUint32(tiff + 4, little)

        for (let entry = ifd + 2; entry < ifd + 2 + view.getUint16(ifd, little) * 12; entry += 12) {
          if (view.getUint16(entry, little) === 0x0112) {
            return view.getUint16(entry + 8, little)
          }
        }

        return 1
      }
    }
  } catch {
    // Truncated or malformed metadata: treat the photo as upright.
  }

  return 1
}

async function embedImage(doc: PDFDocument, file: File): Promise<PDFImage> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50

  // JPEG and PNG embed as-is without re-encoding. Other formats and rotated photos go through a canvas.
  if (isJpeg) {
    return jpegOrientation(bytes) === 1 ? doc.embedJpg(bytes) : doc.embedJpg(await rasterize(file, 'image/jpeg'))
  }

  // ponytail: WebP/AVIF photos become lossless PNGs, which can be large. Encode lossy sources as JPEG if that matters.
  return doc.embedPng(isPng ? bytes : await rasterize(file, 'image/png'))
}

async function rasterize(file: File, type: 'image/png' | 'image/jpeg'): Promise<Uint8Array> {
  let bitmap: ImageBitmap
  try {
    // Applies EXIF orientation by default.
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('This browser could not decode the image.')
  }

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas rendering is unavailable in this browser.')
  }

  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await canvas.convertToBlob({ type, quality: 0.92 })
  return new Uint8Array(await blob.arrayBuffer())
}

function a4(layout: Exclude<Layout, 'original'>): Sheet {
  return layout === 'portrait' ? A4 : [A4[1], A4[0]]
}

function fit(width: number, height: number, [sheetWidth, sheetHeight]: Sheet) {
  const scale = Math.min((sheetWidth - MARGIN * 2) / width, (sheetHeight - MARGIN * 2) / height)
  return {
    width: width * scale,
    height: height * scale,
    x: (sheetWidth - width * scale) / 2,
    y: (sheetHeight - height * scale) / 2,
  }
}

async function save(doc: PDFDocument): Promise<Blob> {
  // slice() copies into a plain ArrayBuffer, which Blob's types require. pdf-lib types its output loosely.
  return new Blob([(await doc.save()).slice()], { type: 'application/pdf' })
}
