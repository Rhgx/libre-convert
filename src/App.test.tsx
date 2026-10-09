import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import type { convertFile } from './conversion/convert'

const pdf = () => new Blob(['%PDF-1.7'], { type: 'application/pdf' })
const file = (name: string) => new File(['data'], name)

function setup(convert: typeof convertFile = vi.fn(async () => pdf())) {
  const preload = vi.fn()
  render(<App convert={convert} preload={preload} />)
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
  return { user: userEvent.setup({ applyAccept: false }), input, convert, preload }
}

describe('App', () => {
  it('skips unsupported files and keeps the rest', async () => {
    const { user, input } = setup()
    await user.upload(input, [file('notes.docx'), file('archive.zip')])

    expect(screen.getByText('Skipped unsupported files: archive.zip')).toBeInTheDocument()
    expect(screen.getByText('notes.docx')).toBeInTheDocument()
    expect(screen.queryByText('archive.zip')).not.toBeInTheDocument()
  })

  it('starts LibreOffice early only when a document is added', async () => {
    const { user, input, preload } = setup()
    await user.upload(input, file('photo.png'))
    expect(preload).not.toHaveBeenCalled()

    await user.upload(input, file('deck.pptx'))
    expect(preload).toHaveBeenCalledOnce()
  })

  it('converts every queued file with the chosen layout', async () => {
    const { user, input, convert } = setup()
    await user.upload(input, [file('a.docx'), file('b.png')])
    await user.selectOptions(screen.getByRole('combobox', { name: /page layout/i }), 'landscape')
    await user.click(screen.getByRole('button', { name: 'Convert 2 files' }))

    expect(await screen.findAllByRole('button', { name: 'Download' })).toHaveLength(2)
    expect(convert).toHaveBeenNthCalledWith(1, expect.any(File), 'writer', 'landscape', expect.any(Function))
    expect(convert).toHaveBeenNthCalledWith(2, expect.any(File), 'image', 'landscape', expect.any(Function))
    expect(screen.getByText('2 of 2 converted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download all/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /merge into one pdf/i })).toBeInTheDocument()
  })

  it('shows the failure and converts again on retry', async () => {
    const convert = vi.fn<typeof convertFile>().mockRejectedValueOnce(new Error('File is damaged')).mockResolvedValue(pdf())
    const { user, input } = setup(convert)
    await user.upload(input, file('broken.xlsx'))
    await user.click(screen.getByRole('button', { name: 'Convert to PDF' }))

    expect(await screen.findByText('File is damaged')).toBeInTheDocument()
    expect(screen.getByText('0 of 1 converted, 1 failed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('button', { name: 'Download' })).toBeInTheDocument()
    expect(convert).toHaveBeenCalledTimes(2)
  })

  it('shows engine progress while a document converts', async () => {
    let finish = () => {}
    const convert = vi.fn<typeof convertFile>(async (_file, _kind, _layout, onNote) => {
      onNote('Downloading LibreOffice')
      await new Promise<void>((resolve) => (finish = resolve))
      return pdf()
    })
    const { user, input } = setup(convert)
    await user.upload(input, file('slides.odp'))
    await user.click(screen.getByRole('button', { name: 'Convert to PDF' }))

    expect(await screen.findByText('Downloading LibreOffice')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /page layout/i })).toBeDisabled()
    finish()
    expect(await screen.findByText(/PDF ready/)).toBeInTheDocument()
  })

  it('removes and clears files', async () => {
    const { user, input } = setup()
    await user.upload(input, [file('a.docx'), file('b.docx')])
    await user.click(screen.getByRole('button', { name: 'Remove a.docx' }))
    expect(screen.queryByText('a.docx')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByText(/add files/i)).toBeInTheDocument()
  })
})
