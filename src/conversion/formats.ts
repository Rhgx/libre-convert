export type OfficeKind = 'writer' | 'calc' | 'impress' | 'draw'
export type Kind = OfficeKind | 'image'
export type Layout = 'original' | 'portrait' | 'landscape'

export const FORMATS: [Kind, string[]][] = [
  ['writer', ['.doc', '.docx', '.docm', '.dotx', '.odt', '.ott', '.rtf', '.txt']],
  ['calc', ['.xls', '.xlsx', '.xlsm', '.ods', '.ots', '.csv']],
  ['impress', ['.ppt', '.pptx', '.pps', '.ppsx', '.odp', '.otp']],
  ['draw', ['.odg']],
  ['image', ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.avif']],
]

export const ACCEPT = FORMATS.flatMap(([, extensions]) => extensions).join(',')

export function extension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot).toLowerCase() : ''
}

export function kindOf(name: string): Kind | undefined {
  const ext = extension(name)
  return FORMATS.find(([, extensions]) => extensions.includes(ext))?.[0]
}

export function pdfName(name: string): string {
  const ext = extension(name)
  return `${ext ? name.slice(0, -ext.length) : name}.pdf`
}

// "a.pdf", "a.pdf" -> "a.pdf", "a (2).pdf", so ZIP entries don't overwrite each other.
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1
    seen.set(name, count)
    return count === 1 ? name : name.replace(/(\.[^.]*)?$/, ` (${count})$1`)
  })
}
