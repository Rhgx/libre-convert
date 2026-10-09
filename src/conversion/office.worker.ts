// Runs inside the LibreOffice WASM thread: opens one file, applies the page layout, exports a PDF.
import type { OfficeJob, OfficeReply } from './convert'
import type { OfficeKind } from './formats'

type PropertySet = {
  getPropertyValue(name: string): unknown
  setPropertyValue(name: string, value: unknown): void
}

type NameAccess<T> = {
  getByName(name: string): T
  getElementNames(): string[]
}

type OfficeDocument = {
  getStyleFamilies(): NameAccess<NameAccess<PropertySet>>
  storeToURL(url: string, properties: unknown[]): void
  close(deliverOwnership: boolean): void
}

type ZetaHelperThread = {
  thrPort: MessagePort
  css: { beans: { PropertyValue: new (value: { Name: string; Value: unknown }) => unknown } }
  zetajs: { catchUnoException(error: unknown): { Message?: string } | undefined }
  desktop: {
    loadComponentFromURL(url: string, target: string, flags: number, properties: unknown[]): OfficeDocument | null
  }
}

// Set on the worker's global scope by zetaHelper.js before this module is imported.
declare const zetajsStore: { ZetaHelperThread: new () => ZetaHelperThread }

const FILTERS: Record<OfficeKind, string> = {
  writer: 'writer_pdf_Export',
  calc: 'calc_pdf_Export',
  impress: 'impress_pdf_Export',
  draw: 'draw_pdf_Export',
}

const { thrPort, css, zetajs, desktop } = new zetajsStore.ZetaHelperThread()
const property = (Name: string, Value: unknown) => new css.beans.PropertyValue({ Name, Value })
const reply = (message: OfficeReply) => thrPort.postMessage(message)

thrPort.onmessage = ({ data: job }: MessageEvent<OfficeJob>) => {
  let doc: OfficeDocument | null = null

  try {
    doc = desktop.loadComponentFromURL(`file://${job.from}`, '_blank', 0, [property('Hidden', true)])
    if (!doc) {
      throw new Error('LibreOffice could not open this file. It may be damaged or password protected.')
    }

    if (job.layout !== 'original' && (job.kind === 'writer' || job.kind === 'calc')) {
      setOrientation(doc, job.kind, job.layout === 'landscape')
    }

    doc.storeToURL(`file://${job.to}`, [property('Overwrite', true), property('FilterName', FILTERS[job.kind])])
    reply({ id: job.id })
  } catch (error) {
    reply({ id: job.id, error: describe(error) })
  } finally {
    try {
      doc?.close(true)
    } catch {
      // The document is already gone; nothing left to free.
    }
  }
}

reply({ ready: true })

// Text and sheets re-paginate natively, which keeps links, bookmarks and selectable text intact.
function setOrientation(doc: OfficeDocument, kind: 'writer' | 'calc', landscape: boolean) {
  const pageStyles = doc.getStyleFamilies().getByName('PageStyles')

  for (const name of pageStyles.getElementNames()) {
    const style = pageStyles.getByName(name)
    style.setPropertyValue('IsLandscape', landscape)

    // Swap the paper size if needed, keeping it (A4, Letter, ...) instead of forcing one.
    const width = Number(style.getPropertyValue('Width'))
    const height = Number(style.getPropertyValue('Height'))
    if (width > height !== landscape) {
      style.setPropertyValue('Width', height)
      style.setPropertyValue('Height', width)
    }

    if (kind === 'calc' && landscape) {
      // Fit all columns on one page width so wide sheets don't split across pages.
      for (const [key, value] of [['PageScale', 0], ['ScaleToPages', 0], ['ScaleToPagesX', 1], ['ScaleToPagesY', 0]] as const) {
        try {
          style.setPropertyValue(key, value)
        } catch {
          // Not every page style exposes every scaling property.
        }
      }
    }
  }
}

function describe(error: unknown): string {
  try {
    const message = zetajs.catchUnoException(error)?.Message
    if (message) {
      return message
    }
  } catch {
    // Not a UNO exception.
  }

  return error instanceof Error && error.message ? error.message : 'LibreOffice could not convert this file.'
}
