import { buildInputPath, buildOutputPath } from './files'
import { convertImageFileToPdf } from './imagePdf'
import { applyPdfPageOrientation } from './pdfOrientation'
import { getPresetById } from './presets'
import { mapWorkerError, parseWorkerResponse } from './workerProtocol'
import { resolveBundledAssetUrl, resolvePublicAssetUrl } from './assetUrls'
import { markZetaRuntimeUsed, scheduleZetaRuntimeWarmup } from './zetaRuntimeCache'
import type { ConvertFileRequest, ConversionJobStatus, WorkerRequest, WorkerResponse } from '../types/conversion'
import libreOfficeThreadUrl from '../workers/libreOffice.thread.ts?worker&url'

type ZetaHelperMainCtor = new (
  threadJs: string,
  options: {
    threadJsType?: 'classic' | 'module'
    wasmPkg?: string | null
    blockPageScroll?: boolean
  },
) => {
  thrPort: MessagePort
  FS: {
    writeFile(path: string, data: Uint8Array): void
    readFile(path: string): Uint8Array
    unlink(path: string): void
  }
  start(appInit: () => void): void
}

type ZetaRuntime = {
  helper: InstanceType<ZetaHelperMainCtor>
  fs: {
    writeFile(path: string, data: Uint8Array): void
    readFile(path: string): Uint8Array
    unlink(path: string): void
  }
  port: MessagePort
}

type PendingJob = {
  fromPath: string
  toPath: string
  resolve: (data: ArrayBuffer) => void
  reject: (error: Error) => void
  onStatus?: (status: Extract<ConversionJobStatus, 'initializing' | 'converting'>, message?: string) => void
}

export interface ConversionService {
  convert(request: ConvertFileRequest): Promise<ArrayBuffer>
}

type PermissionStatusLike = Pick<PermissionStatus, 'name' | 'state' | 'onchange' | 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>

let clipboardPermissionShimInstalled = false

function createDeniedPermissionStatus(name: 'clipboard-read' | 'clipboard-write'): PermissionStatusLike {
  return {
    name,
    state: 'denied',
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false
    },
  }
}

function installClipboardPermissionShim() {
  if (clipboardPermissionShimInstalled || typeof navigator === 'undefined') {
    return
  }

  const query = navigator.permissions?.query
  if (!query) {
    clipboardPermissionShimInstalled = true
    return
  }

  const wrappedQuery: Permissions['query'] = async (descriptor) => {
    try {
      return await query.call(navigator.permissions, descriptor)
    } catch (error) {
      const name = String((descriptor as PermissionDescriptor & { name?: unknown }).name ?? '')
      if (
        error instanceof TypeError &&
        (name === 'clipboard-read' || name === 'clipboard-write')
      ) {
        return createDeniedPermissionStatus(name) as PermissionStatus
      }

      throw error
    }
  }

  navigator.permissions.query = wrappedQuery
  clipboardPermissionShimInstalled = true
}

class LibreOfficeClient implements ConversionService {
  private runtime?: ZetaRuntime
  private initPromise?: Promise<ZetaRuntime>
  private readyResolver?: (runtime: ZetaRuntime) => void
  private readyRejector?: (error: Error) => void
  private initialized = false
  private pendingJobs = new Map<string, PendingJob>()
  private readonly env = import.meta.env as ImportMetaEnv & { VITE_ZETAOFFICE_WASM_PKG?: string }
  private readonly zetaHelperUrl = resolvePublicAssetUrl(
    'vendor/zetajs/1.2.0/zetaHelper.js',
    import.meta.env.BASE_URL,
    import.meta.url,
  )
  private readonly zetaJsUrl = resolvePublicAssetUrl(
    'vendor/zetajs/1.2.0/zeta.js',
    import.meta.env.BASE_URL,
    import.meta.url,
  )
  private readonly threadUrl = resolveBundledAssetUrl(libreOfficeThreadUrl, import.meta.url)
  private readonly wasmPkg = this.env.VITE_ZETAOFFICE_WASM_PKG || 'free'

  constructor() {
    scheduleZetaRuntimeWarmup({
      wasmPkg: this.wasmPkg,
      zetaHelperUrl: this.zetaHelperUrl,
      zetaJsUrl: this.zetaJsUrl,
      threadUrl: this.threadUrl,
    })
  }

  async convert({ jobId, file, presetId, pageOrientation, onStatus }: ConvertFileRequest): Promise<ArrayBuffer> {
    const orientation = pageOrientation ?? 'vertical'

    if (presetId === 'image-to-pdf') {
      onStatus?.('initializing', 'Preparing image for PDF layout')
      onStatus?.('converting', 'Rendering image into a PDF page')
      return convertImageFileToPdf(file, orientation)
    }

    const runtime = await this.ensureRuntime()

    if (!this.initialized) {
      onStatus?.('initializing', 'Starting LibreOffice inside the worker')
      runtime.port.postMessage({ cmd: 'init' } satisfies WorkerRequest)
      this.initialized = true
    }

    const inputPath = buildInputPath(jobId, file.name)
    const outputPath = buildOutputPath(jobId)
    const preset = getPresetById(presetId)
    const buffer = new Uint8Array(await file.arrayBuffer())

    runtime.fs.writeFile(inputPath, buffer)

    const pdfBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      this.pendingJobs.set(jobId, {
        fromPath: inputPath,
        toPath: outputPath,
        resolve,
        reject,
        onStatus,
      })

      runtime.port.postMessage({
        cmd: 'convert',
        jobId,
        fromPath: inputPath,
        toPath: outputPath,
        presetFamily: preset.family,
        filterName: preset.filterName,
        pageOrientation: orientation,
      } satisfies WorkerRequest)
    })

    return applyPdfPageOrientation(pdfBuffer, orientation)
  }

  private async ensureRuntime(): Promise<ZetaRuntime> {
    if (this.runtime) {
      return this.runtime
    }

    if (!this.initPromise) {
      this.initPromise = this.initializeRuntime()
    }

    return this.initPromise
  }

  private async initializeRuntime(): Promise<ZetaRuntime> {
    installClipboardPermissionShim()
    const { ZetaHelperMain } = (await import(/* @vite-ignore */ this.zetaHelperUrl)) as {
      ZetaHelperMain: ZetaHelperMainCtor
    }

    return new Promise<ZetaRuntime>((resolve, reject) => {
      this.readyResolver = resolve
      this.readyRejector = reject

      const helper = new ZetaHelperMain(this.threadUrl, {
        threadJsType: 'module',
        wasmPkg: this.wasmPkg,
        blockPageScroll: false,
      })

      helper.start(() => {
        const runtime: ZetaRuntime = {
          helper,
          fs: helper.FS,
          port: helper.thrPort,
        }

        this.runtime = runtime
        helper.thrPort.onmessage = (event) => {
          this.handleWorkerMessage(runtime, event.data)
        }
      })

      window.addEventListener(
        'error',
        (event: ErrorEvent) => {
          if (String(event.message || '').includes('SharedArrayBuffer')) {
            reject(new Error('This browser session is not cross-origin isolated. COOP/COEP headers are required.'))
          }
        },
        { once: true },
      )
    })
  }

  private handleWorkerMessage(runtime: ZetaRuntime, payload: unknown) {
    const message = parseWorkerResponse(payload)
    if (!message) {
      return
    }

    switch (message.cmd) {
      case 'status':
        if (message.status === 'ready' && this.readyResolver) {
          markZetaRuntimeUsed()
          this.readyResolver(runtime)
          this.readyResolver = undefined
          this.readyRejector = undefined
        }

        if (message.jobId) {
          this.pendingJobs.get(message.jobId)?.onStatus?.(
            message.status === 'ready' ? 'converting' : message.status,
            message.message,
          )
        }
        break
      case 'success':
        this.finalizeSuccess(runtime, message)
        break
      case 'error':
        if (message.jobId) {
          this.finalizeError(runtime, message.jobId, mapWorkerError(message.message))
        } else if (this.readyRejector) {
          this.readyRejector(new Error(mapWorkerError(message.message)))
          this.readyResolver = undefined
          this.readyRejector = undefined
        }
        break
    }
  }

  private finalizeSuccess(runtime: ZetaRuntime, message: Extract<WorkerResponse, { cmd: 'success' }>) {
    const pending = this.pendingJobs.get(message.jobId)
    if (!pending) {
      return
    }

    try {
      const data = runtime.fs.readFile(message.toPath)
      const output = new Uint8Array(data)
      pending.resolve(output.buffer)
    } catch (error) {
      pending.reject(error instanceof Error ? error : new Error('Unable to read the converted PDF from the in-browser filesystem.'))
    } finally {
      this.cleanupFs(runtime, pending.fromPath, pending.toPath)
      this.pendingJobs.delete(message.jobId)
    }
  }

  private finalizeError(runtime: ZetaRuntime, jobId: string, message: string) {
    const pending = this.pendingJobs.get(jobId)
    if (!pending) {
      return
    }

    this.cleanupFs(runtime, pending.fromPath, pending.toPath)
    this.pendingJobs.delete(jobId)
    pending.reject(new Error(message))
  }

  private cleanupFs(runtime: ZetaRuntime, ...paths: string[]) {
    for (const path of paths) {
      try {
        runtime.fs.unlink(path)
      } catch {
        // Ignore repeated cleanup attempts.
      }
    }
  }
}

export function createLibreOfficeClient(): ConversionService {
  return new LibreOfficeClient()
}
