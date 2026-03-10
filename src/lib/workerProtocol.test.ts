import { describe, expect, it } from 'vitest'
import { mapWorkerError, parseWorkerResponse } from './workerProtocol'

describe('workerProtocol', () => {
  it('parses valid status messages', () => {
    const payload = parseWorkerResponse({
      cmd: 'status',
      status: 'converting',
      jobId: 'job-1',
      message: 'Exporting PDF output',
    })

    expect(payload).toEqual({
      cmd: 'status',
      status: 'converting',
      jobId: 'job-1',
      message: 'Exporting PDF output',
    })
  })

  it('rejects malformed messages', () => {
    expect(parseWorkerResponse({ cmd: 'status', status: 'bad' })).toBeNull()
    expect(parseWorkerResponse('status')).toBeNull()
  })

  it('maps missing isolation errors to a user message', () => {
    expect(mapWorkerError('SharedArrayBuffer is not defined')).toContain('Cross-origin isolation is missing')
  })
})
