declare module '/vendor/zetajs/1.2.0/zetaHelper.js' {
  interface ZetaHelperOptions {
    threadJsType?: 'classic' | 'module'
    wasmPkg?: string | null
    blockPageScroll?: boolean
  }

  export class ZetaHelperMain {
    constructor(threadJs: string, options: ZetaHelperOptions)
    thrPort: MessagePort
    FS: {
      writeFile(path: string, data: Uint8Array): void
      readFile(path: string): Uint8Array
      unlink(path: string): void
    }
    start(appInit: () => void): void
  }

  export class ZetaHelperThread {
    zetajs: {
      mainPort: MessagePort
      catchUnoException(error: unknown): { Message?: string }
      type: {
        interface(value: unknown): unknown
      }
      uno: {
        com: {
          sun: {
            star: Record<string, unknown>
          }
        }
      }
    }
    thrPort: MessagePort
    css: any
    context: unknown
    desktop: any
  }
}
