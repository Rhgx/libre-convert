import type { WorkerResponse } from '../types/conversion'

export function parseWorkerResponse(payload: unknown): WorkerResponse | null {
  if (!payload || typeof payload !== 'object' || !('cmd' in payload)) {
    return null
  }

  const message = payload as Record<string, unknown>

  switch (message.cmd) {
    case 'status':
      if (message.status === 'ready' || message.status === 'initializing' || message.status === 'converting') {
        return {
          cmd: 'status',
          status: message.status,
          jobId: typeof message.jobId === 'string' ? message.jobId : undefined,
          message: typeof message.message === 'string' ? message.message : undefined,
        }
      }
      return null
    case 'success':
      if (typeof message.jobId === 'string' && typeof message.fromPath === 'string' && typeof message.toPath === 'string') {
        return {
          cmd: 'success',
          jobId: message.jobId,
          fromPath: message.fromPath,
          toPath: message.toPath,
        }
      }
      return null
    case 'error':
      if (typeof message.message === 'string') {
        return {
          cmd: 'error',
          jobId: typeof message.jobId === 'string' ? message.jobId : undefined,
          message: message.message,
        }
      }
      return null
    default:
      return null
  }
}

export function mapWorkerError(message: string | undefined): string {
  if (!message) {
    return 'LibreOffice returned an unknown conversion error.'
  }

  if (message.includes('NetworkError') || message.includes('SharedArrayBuffer')) {
    return 'Cross-origin isolation is missing. Serve the site with COOP/COEP headers and try again.'
  }

  return message
}
