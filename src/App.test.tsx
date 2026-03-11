import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import type { ConvertFileRequest } from './types/conversion'

describe('App', () => {
  it('accepts every supported office format in the file picker', () => {
    render(<App service={{ convert: vi.fn() }} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input.accept).toBe('.doc,.docx,.odt,.rtf,.txt,.xls,.xlsx,.ods,.csv,.ppt,.pptx,.odp,.png,.jpg,.jpeg,.gif,.bmp')
  })

  it('rejects unsupported files during auto-detect', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<App service={{ convert: vi.fn() }} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(
      input,
      new File(['plain text'], 'archive.zip', {
        type: 'application/zip',
      }),
    )

    expect(screen.getByText(/unsupported file types/i)).toBeInTheDocument()
  })

  it('auto-detects image files for pdf conversion', async () => {
    const user = userEvent.setup()
    const convert = vi.fn(async ({ onStatus }: ConvertFileRequest) => {
      onStatus?.('initializing')
      onStatus?.('converting')
      return new TextEncoder().encode('%PDF-1.4').buffer
    })

    render(<App service={{ convert }} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(
      input,
      new File(['pixels'], 'photo.png', {
        type: 'image/png',
      }),
    )
    await user.click(screen.getByRole('button', { name: /convert to pdf/i }))

    await waitFor(() => expect(screen.getByRole('link', { name: /download/i })).toBeInTheDocument())
    expect(convert).toHaveBeenCalledWith(
      expect.objectContaining({
        presetId: 'image-to-pdf',
      }),
    )
  })

  it('auto-detects the preset, converts, and exposes a download link', async () => {
    const user = userEvent.setup()
    const convert = vi.fn(async ({ onStatus }: ConvertFileRequest) => {
      onStatus?.('initializing')
      onStatus?.('converting')
      return new TextEncoder().encode('%PDF-1.4').buffer
    })

    render(<App service={{ convert }} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(
      input,
      new File(['hello'], 'sheet.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    )
    await user.click(screen.getByRole('button', { name: /convert to pdf/i }))

    await waitFor(() => expect(screen.getByRole('link', { name: /download/i })).toBeInTheDocument())
    expect(convert).toHaveBeenCalledTimes(1)
    expect(convert).toHaveBeenCalledWith(
      expect.objectContaining({
        presetId: 'excel-to-pdf',
      }),
    )
    expect(screen.getByText(/ready to download/i)).toBeInTheDocument()
  })

  it('hides the global progress header for a single uploaded file', async () => {
    const user = userEvent.setup()
    render(<App service={{ convert: vi.fn() }} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(
      input,
      new File(['hello'], 'memo.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    )

    expect(screen.queryByLabelText(/conversion progress/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('Queued').length).toBeGreaterThan(0)
  })

  it('keeps internal engine messages out of the job row copy', async () => {
    const user = userEvent.setup()
    const convert = vi.fn(async ({ onStatus }: ConvertFileRequest) => {
      onStatus?.('initializing', 'Starting LibreOffice inside the worker')
      onStatus?.('converting', 'Exporting PDF output')
      return new Promise<ArrayBuffer>(() => {})
    })

    render(<App service={{ convert }} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(
      input,
      new File(['hello'], 'memo.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    )
    await user.click(screen.getByRole('button', { name: /convert to pdf/i }))

    await waitFor(() => expect(screen.getAllByText('Converting').length).toBeGreaterThan(0))
    expect(screen.queryByText('Starting LibreOffice inside the worker')).not.toBeInTheDocument()
    expect(screen.queryByText('Exporting PDF output')).not.toBeInTheDocument()
  })
})
