import type { WorkerRequest } from '../types/conversion'

type ZetaThreadInstance = {
  zetajs: {
    mainPort: MessagePort
    catchUnoException(error: unknown): { Message?: string } | undefined
    type: {
      interface(type: unknown): unknown
    }
  }
  css: {
    beans: {
      PropertyValue: new (value: { Name: string; Value: unknown }) => unknown
    }
    util: {
      XCloseable: unknown
    }
  }
  desktop: {
    loadComponentFromURL(url: string, target: string, searchFlags: number, props: unknown[]): {
      close(deliverOwnership: boolean): void
      queryInterface(type: unknown): unknown
      storeToURL(url: string, props: unknown[]): void
    }
  }
  thrPort: MessagePort
}

function installWorker(zetaThread: ZetaThreadInstance) {
  const zetajs = zetaThread.zetajs
  const css = zetaThread.css

  let currentModel: { close: (deliverOwnership: boolean) => void; queryInterface: (type: unknown) => unknown; storeToURL: (url: string, props: unknown[]) => void } | undefined
  let beanHidden: unknown
  let beanOverwrite: unknown
  let initialized = false

  function ensureInitialized() {
    if (initialized) {
      return
    }

    beanHidden = new css.beans.PropertyValue({ Name: 'Hidden', Value: true })
    beanOverwrite = new css.beans.PropertyValue({ Name: 'Overwrite', Value: true })
    initialized = true
  }

  zetaThread.thrPort.onmessage = (event: MessageEvent<WorkerRequest>) => {
    switch (event.data.cmd) {
      case 'init':
        ensureInitialized()
        zetajs.mainPort.postMessage({ cmd: 'status', status: 'ready' })
        break
      case 'convert':
        ensureInitialized()
        zetajs.mainPort.postMessage({
          cmd: 'status',
          status: 'initializing',
          jobId: event.data.jobId,
          message: 'Loading document into LibreOffice',
        })

        try {
          if (currentModel && currentModel.queryInterface(zetajs.type.interface(css.util.XCloseable))) {
            currentModel.close(false)
          }

          const exportFilter = new css.beans.PropertyValue({
            Name: 'FilterName',
            Value: event.data.filterName,
          })

          zetajs.mainPort.postMessage({
            cmd: 'status',
            status: 'converting',
            jobId: event.data.jobId,
            message: 'Exporting PDF output',
          })

          const model = zetaThread.desktop.loadComponentFromURL(`file://${event.data.fromPath}`, '_blank', 0, [beanHidden])
          currentModel = model
          model.storeToURL(`file://${event.data.toPath}`, [beanOverwrite, exportFilter])

          zetajs.mainPort.postMessage({
            cmd: 'success',
            jobId: event.data.jobId,
            fromPath: event.data.fromPath,
            toPath: event.data.toPath,
          })
        } catch (error) {
          let message = 'LibreOffice could not convert this document.'
          try {
            const unoError = zetajs.catchUnoException(error)
            message = unoError?.Message || message
          } catch {
            if (error instanceof Error && error.message) {
              message = error.message
            }
          }

          zetajs.mainPort.postMessage({
            cmd: 'error',
            jobId: event.data.jobId,
            message,
          })
        }
        break
      default:
        zetajs.mainPort.postMessage({
          cmd: 'error',
          message: 'Unknown worker request received.',
        })
    }
  }

  setTimeout(() => {
    zetajs.mainPort.postMessage({ cmd: 'status', status: 'ready' })
  }, 0)
}

void (async () => {
  const zetaHelperModuleUrl = new URL('/vendor/zetajs/1.2.0/zetaHelper.js', globalThis.location.origin).toString()
  const { ZetaHelperThread } = (await import(/* @vite-ignore */ zetaHelperModuleUrl)) as {
    ZetaHelperThread: new () => ZetaThreadInstance
  }

  installWorker(new ZetaHelperThread())
})()
