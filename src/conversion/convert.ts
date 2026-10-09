import officeWorkerUrl from './office.worker.ts?worker&url'
import { extension, type Kind, type Layout, type OfficeKind } from './formats'

// Messages exchanged with office.worker.ts.
export type OfficeJob = { id: number; from: string; to: string; kind: OfficeKind; layout: Layout }
export type OfficeReply = { ready: true } | { id: number; error?: string }

type ZetaHelperMain = {
  thrPort: MessagePort
  FS: {
    writeFile(path: string, data: Uint8Array): void
    readFile(path: string): Uint8Array
    unlink(path: string): void
  }
  Module: { onAbort?: () => void }
  start(onThreadStarted: () => void): void
}

type ZetaHelperModule = {
  ZetaHelperMain: new (threadJs: string, options: { threadJsType: 'module'; blockPageScroll: boolean }) => ZetaHelperMain
}

const ZETA_HELPER_URL = `${import.meta.env.BASE_URL}vendor/zetajs/1.2.0/zetaHelper.js`
// Any runtime file works; the service worker caches them as a set.
const RUNTIME_PROBE_URL = 'https://cdn.zetaoffice.net/zetaoffice_latest/soffice.wasm'

let office: Promise<ZetaHelperMain> | undefined
let officeReady = false
let nextJobId = 0
const pending = new Map<number, { resolve: () => void; reject: (error: Error) => void }>()

export async function convertFile(
  file: File,
  kind: Kind,
  layout: Layout,
  onNote: (note: string | undefined) => void,
): Promise<Blob> {
  const pdf = await import('./pdf')

  if (kind === 'image') {
    return pdf.imageToPdf(file, layout)
  }

  if (!officeReady) {
    onNote((await isRuntimeCached()) ? 'Starting LibreOffice' : 'Downloading LibreOffice (about 50 MB, first time only)')
  }

  const helper = await startOffice()
  onNote(undefined)
  const output = await runOfficeJob(helper, file, kind, layout)

  // Slides and drawings can't be re-paginated, so they are scaled onto the chosen sheet instead.
  if (layout !== 'original' && (kind === 'impress' || kind === 'draw')) {
    return pdf.fitPages(output, layout)
  }

  return new Blob([output], { type: 'application/pdf' })
}

// Starts downloading and booting LibreOffice as soon as a document is added, ahead of the Convert click.
export function preloadOffice() {
  startOffice().catch(() => {
    // Boot errors are reported on the first job that needs LibreOffice.
  })
}

function startOffice(): Promise<ZetaHelperMain> {
  office ??= bootOffice()
  return office
}

async function bootOffice(): Promise<ZetaHelperMain> {
  if (!crossOriginIsolated) {
    throw new Error(
      'This page is not cross-origin isolated, so LibreOffice cannot run. Reload the page. If that does not help, the browser is blocking the service worker this site needs.',
    )
  }

  const { ZetaHelperMain } = (await import(/* @vite-ignore */ ZETA_HELPER_URL)) as ZetaHelperModule

  return new Promise<ZetaHelperMain>((resolve, reject) => {
    const fail = (reason: string) => {
      const error = new Error(`${reason} Reload the page to try again.`)
      window.removeEventListener('error', onLoadError, true)
      reject(error)
      for (const job of pending.values()) {
        job.reject(error)
      }
      pending.clear()
      // Later conversions fail fast with the same error. The no-op catch only marks it as handled.
      office = Promise.reject(error)
      office.catch(() => {})
    }

    // Nothing else on the page runs while LibreOffice boots, so any uncaught error means the runtime failed
    // to load (offline, CDN down). Its errors come from a cross-origin script, so they carry no details.
    // Capturing also catches the runtime <script> tag failing to load, which doesn't bubble.
    const onLoadError = () => fail('LibreOffice failed to load.')
    window.addEventListener('error', onLoadError, true)

    const helper = new ZetaHelperMain(new URL(officeWorkerUrl, import.meta.url).href, {
      threadJsType: 'module',
      blockPageScroll: false,
    })
    helper.Module.onAbort = () => fail('LibreOffice stopped unexpectedly.')

    helper.start(() => {
      helper.thrPort.onmessage = ({ data }: MessageEvent<OfficeReply>) => {
        if ('ready' in data) {
          window.removeEventListener('error', onLoadError, true)
          officeReady = true
          resolve(helper)
          return
        }

        const job = pending.get(data.id)
        pending.delete(data.id)
        if (data.error) {
          job?.reject(new Error(data.error))
        } else {
          job?.resolve()
        }
      }
    })
  })
}

async function runOfficeJob(helper: ZetaHelperMain, file: File, kind: OfficeKind, layout: Layout) {
  const id = nextJobId++
  // LibreOffice uses the extension as a hint when detecting the import filter.
  const from = `/tmp/in-${id}${extension(file.name)}`
  const to = `/tmp/out-${id}.pdf`

  helper.FS.writeFile(from, new Uint8Array(await file.arrayBuffer()))

  try {
    await new Promise<void>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      helper.thrPort.postMessage({ id, from, to, kind, layout } satisfies OfficeJob)
    })
    // Copy out of the shared WASM memory; Blob and pdf-lib need a regular ArrayBuffer.
    return new Uint8Array(helper.FS.readFile(to))
  } finally {
    for (const path of [from, to]) {
      try {
        helper.FS.unlink(path)
      } catch {
        // The output doesn't exist when the export failed.
      }
    }
  }
}

async function isRuntimeCached(): Promise<boolean> {
  return 'caches' in window && (await caches.match(RUNTIME_PROBE_URL)) !== undefined
}
