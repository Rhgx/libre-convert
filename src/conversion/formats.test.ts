import { describe, expect, it } from 'vitest'
import { kindOf, pdfName, uniqueNames } from './formats'

describe('formats', () => {
  it('detects the converter from the extension, case-insensitively', () => {
    expect(kindOf('Report.DOCX')).toBe('writer')
    expect(kindOf('budget.xlsm')).toBe('calc')
    expect(kindOf('deck.ppsx')).toBe('impress')
    expect(kindOf('diagram.odg')).toBe('draw')
    expect(kindOf('photo.webp')).toBe('image')
    expect(kindOf('archive.zip')).toBeUndefined()
    expect(kindOf('docx')).toBeUndefined()
  })

  it('names the output after the input', () => {
    expect(pdfName('notes.final.docx')).toBe('notes.final.pdf')
    expect(pdfName('README')).toBe('README.pdf')
  })

  it('numbers duplicate names', () => {
    expect(uniqueNames(['a.pdf', 'b.pdf', 'a.pdf', 'a.pdf'])).toEqual(['a.pdf', 'b.pdf', 'a (2).pdf', 'a (3).pdf'])
  })
})
