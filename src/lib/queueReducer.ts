import { getPresetById } from './presets'
import type { ConversionJob, ConversionJobStatus } from '../types/conversion'

type QueueAction =
  | { type: 'enqueue'; jobs: ConversionJob[] }
  | { type: 'status'; jobId: string; status: ConversionJobStatus; message?: string }
  | { type: 'success'; jobId: string; downloadUrl: string; outputFileName: string }
  | { type: 'retry'; jobId: string }
  | { type: 'remove'; jobId: string }

export function queueReducer(state: ConversionJob[], action: QueueAction): ConversionJob[] {
  switch (action.type) {
    case 'enqueue':
      return [...state, ...action.jobs]
    case 'status':
      return state.map((job) => {
        if (job.id !== action.jobId) {
          return job
        }

        return {
          ...job,
          status: action.status,
          message: action.message,
          downloadUrl: action.status === 'error' ? undefined : job.downloadUrl,
          outputFileName: action.status === 'error' ? undefined : job.outputFileName,
          statusLabel: getStatusLabel(job, action.status),
        }
      })
    case 'success':
      return state.map((job) => {
        if (job.id !== action.jobId) {
          return job
        }

        return {
          ...job,
          status: 'ready',
          message: undefined,
          downloadUrl: action.downloadUrl,
          outputFileName: action.outputFileName,
          statusLabel: 'PDF ready for download',
        }
      })
    case 'retry':
      return state.map((job) => {
        if (job.id !== action.jobId) {
          return job
        }

        return {
          ...job,
          status: 'queued',
          message: undefined,
          downloadUrl: undefined,
          outputFileName: undefined,
          statusLabel: `Queued for ${getPresetById(job.presetId).label}`,
        }
      })
    case 'remove':
      return state.filter((job) => job.id !== action.jobId)
    default:
      return state
  }
}

function getStatusLabel(job: ConversionJob, status: ConversionJobStatus): string {
  switch (status) {
    case 'queued':
      return `Queued for ${getPresetById(job.presetId).label}`
    case 'initializing':
      return 'Booting the local LibreOffice engine'
    case 'converting':
      return 'Converting document to PDF'
    case 'ready':
      return 'PDF ready for download'
    case 'error':
      return 'Conversion failed'
  }
}
