import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import type { ConvertFileRequest } from './types/conversion'

describe('App', () => {
  it('accepts every supported office format in the file picker', () => {
    render(<App service={{ convert: vi.fn() }} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input.accept).toBe('.doc,.docx,.odt,.rtf,.txt,.xls,.xlsx,.ods,.csv,.ppt,.pptx,.odp')
  })

  it('rejects unsupported files during auto-detect', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<App service={{ convert: vi.fn() }} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(
      input,
      new File(['plain text'], 'photo.png', {
        type: 'image/png',
      }),
    )

    expect(screen.getByText(/unsupported file types/i)).toBeInTheDocument()
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
    expect(screen.getByText(/pdf ready for download/i)).toBeInTheDocument()
  })
})
