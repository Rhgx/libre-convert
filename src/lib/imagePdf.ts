import type { PageOrientation } from '../types/conversion'

const PDF_PAGE_SIZE = {
  vertical: { width: 595.28, height: 841.89 },
  horizontal: { width: 841.89, height: 595.28 },
} as const

const PDF_MARGIN = 36

export async function convertImageFileToPdf(file: File, orientation: PageOrientation): Promise<ArrayBuffer> {
  const image = await loadImage(file)
  const jpegData = await rasterizeImageToJpeg(image)
  const pdfBytes = buildImagePdfDocument({
    imageWidth: image.naturalWidth,
    imageHeight: image.naturalHeight,
    jpegData,
    orientation,
  })

  return pdfBytes.slice().buffer
}

export function buildImagePdfDocument({
  imageWidth,
  imageHeight,
  jpegData,
  orientation,
}: {
  imageWidth: number
  imageHeight: number
  jpegData: Uint8Array
  orientation: PageOrientation
}): Uint8Array {
  const page = PDF_PAGE_SIZE[orientation]
  const maxWidth = page.width - PDF_MARGIN * 2
  const maxHeight = page.height - PDF_MARGIN * 2
  const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight)
  const drawWidth = imageWidth * scale
  const drawHeight = imageHeight * scale
  const offsetX = (page.width - drawWidth) / 2
  const offsetY = (page.height - drawHeight) / 2
  const contentStream = encodeText(`q
${formatNumber(drawWidth)} 0 0 ${formatNumber(drawHeight)} ${formatNumber(offsetX)} ${formatNumber(offsetY)} cm
/Im0 Do
Q`)

  const objects = [
    encodeText('<< /Type /Catalog /Pages 2 0 R >>'),
    encodeText('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    encodeText(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${formatNumber(page.width)} ${formatNumber(page.height)}] /Resources << /ProcSet [/PDF /ImageC] /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`,
    ),
    buildStreamObject(contentStream),
    buildStreamObject(
      jpegData,
      `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegData.length} >>`,
    ),
  ]

  return buildPdf(objects)
}

function buildPdf(objects: Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = [encodeText('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n')]
  const offsets: number[] = [0]
  let cursor = parts[0].length

  objects.forEach((objectBytes, index) => {
    offsets.push(cursor)
    const prefix = encodeText(`${index + 1} 0 obj\n`)
    const suffix = encodeText('\nendobj\n')
    parts.push(prefix, objectBytes, suffix)
    cursor += prefix.length + objectBytes.length + suffix.length
  })

  const xrefOffset = cursor
  const xref = [
    encodeText(`xref\n0 ${objects.length + 1}\n`),
    encodeText('0000000000 65535 f \n'),
    ...offsets.slice(1).map((offset) => encodeText(`${String(offset).padStart(10, '0')} 00000 n \n`)),
  ]
  const trailer = encodeText(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  )

  return concatBytes([...parts, ...xref, trailer])
}

function buildStreamObject(data: Uint8Array, dictionary?: string): Uint8Array {
  const header = encodeText(`${dictionary ?? `<< /Length ${data.length} >>`}\nstream\n`)
  const footer = encodeText('\nendstream')
  return concatBytes([header, data, footer])
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }

  return result
}

function encodeText(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function formatNumber(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '')
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file)

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('The selected image could not be decoded in the browser.'))
      image.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function rasterizeImageToJpeg(image: HTMLImageElement): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas rendering is unavailable in this browser session.')
  }

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0)

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
  return decodeBase64(dataUrl.slice(dataUrl.indexOf(',') + 1))
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}
