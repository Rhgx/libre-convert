import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { fitPages, imageToPdf, jpegOrientation, mergePdfs } from './pdf'

// 2x1 red PNG.
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4nGP4z8Dwn4EBAAj+Af9IxWaQAAAAAElFTkSuQmCC'),
  (char) => char.charCodeAt(0),
)

async function pageSizes(pdf: Blob | Uint8Array) {
  const doc = await PDFDocument.load(pdf instanceof Blob ? await pdf.arrayBuffer() : pdf)
  return doc.getPages().map((page) => page.getSize())
}

async function makePdf(pages: number, width: number, height: number) {
  const doc = await PDFDocument.create()
  for (let index = 0; index < pages; index += 1) {
    doc.addPage([width, height]).drawRectangle({ x: 10, y: 10, width: 20, height: 20 })
  }
  return (await doc.save()).slice()
}

describe('imageToPdf', () => {
  it('sizes the page to the image for the original layout', async () => {
    const pdf = await imageToPdf(new File([PNG], 'dot.png'), 'original')
    expect(await pageSizes(pdf)).toEqual([{ width: 1.5, height: 0.75 }])
  })

  it('places the image on A4 for portrait and landscape', async () => {
    const landscape = await imageToPdf(new File([PNG], 'dot.png'), 'landscape')
    expect(await pageSizes(landscape)).toEqual([{ width: 841.89, height: 595.28 }])
  })
})

describe('fitPages', () => {
  it('moves every slide onto an A4 sheet in the chosen orientation', async () => {
    const slides = await makePdf(2, 960, 540)
    expect(await pageSizes(await fitPages(slides, 'portrait'))).toEqual([
      { width: 595.28, height: 841.89 },
      { width: 595.28, height: 841.89 },
    ])
  })
})

describe('mergePdfs', () => {
  it('appends all pages in order', async () => {
    const first = new Blob([await makePdf(1, 100, 200)])
    const second = new Blob([await makePdf(2, 300, 100)])
    const sizes = await pageSizes(await mergePdfs([first, second]))
    expect(sizes.map((size) => size.width)).toEqual([100, 300, 300])
  })
})

describe('jpegOrientation', () => {
  it('reads the EXIF orientation tag', () => {
    const exif = [
      0xff, 0xd8, // start of image
      0xff, 0xe1, 0x00, 0x22, // APP1, length 34
      0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
      0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian TIFF header, IFD at 8
      0x00, 0x01, // one entry
      0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, // orientation = 6
      0x00, 0x00, 0x00, 0x00,
    ]
    expect(jpegOrientation(Uint8Array.from(exif))).toBe(6)
  })

  it('treats JPEGs without EXIF or with broken metadata as upright', () => {
    expect(jpegOrientation(Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x00, 0x00, 0xff, 0xda]))).toBe(1)
    expect(jpegOrientation(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x40, 0x45, 0x78, 0x69, 0x66]))).toBe(1)
  })
})
