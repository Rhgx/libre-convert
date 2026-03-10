import { describe, expect, it } from 'vitest'
import { queueReducer } from './queueReducer'
import type { ConversionJob } from '../types/conversion'

function createJob(overrides: Partial<ConversionJob> = {}): ConversionJob {
  return {
    id: 'job-1',
    presetId: 'word-to-pdf',
    file: new File(['test'], 'memo.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
    status: 'queued',
    statusLabel: 'Queued for Word to PDF',
    ...overrides,
  }
}

describe('queueReducer', () => {
  it('enqueues jobs in order', () => {
    const state = queueReducer([], {
      type: 'enqueue',
      jobs: [createJob(), createJob({ id: 'job-2', file: new File(['x'], 'sheet.xlsx') })],
    })

    expect(state.map((job) => job.id)).toEqual(['job-1', 'job-2'])
  })

  it('moves jobs through conversion stages', () => {
    const queued = [createJob()]
    const initializing = queueReducer(queued, { type: 'status', jobId: 'job-1', status: 'initializing' })
    const converting = queueReducer(initializing, { type: 'status', jobId: 'job-1', status: 'converting' })
    const ready = queueReducer(converting, {
      type: 'success',
      jobId: 'job-1',
      downloadUrl: 'blob:pdf',
      outputFileName: 'memo.pdf',
    })

    expect(initializing[0]?.status).toBe('initializing')
    expect(converting[0]?.status).toBe('converting')
    expect(ready[0]?.status).toBe('ready')
    expect(ready[0]?.outputFileName).toBe('memo.pdf')
  })

  it('retries and removes jobs cleanly', () => {
    const ready = [
      createJob({
        status: 'ready',
        statusLabel: 'PDF ready for download',
        downloadUrl: 'blob:pdf',
        outputFileName: 'memo.pdf',
      }),
    ]

    const retried = queueReducer(ready, { type: 'retry', jobId: 'job-1' })
    const removed = queueReducer(retried, { type: 'remove', jobId: 'job-1' })

    expect(retried[0]?.status).toBe('queued')
    expect(retried[0]?.downloadUrl).toBeUndefined()
    expect(removed).toHaveLength(0)
  })
})
