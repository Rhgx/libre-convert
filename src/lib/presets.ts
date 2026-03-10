import type { ConversionPreset, ConversionPresetId } from '../types/conversion'

export const PRESETS: ConversionPreset[] = [
  {
    id: 'word-to-pdf',
    label: 'Word to PDF',
    description: 'DOC, DOCX, ODT, RTF, and TXT documents keep their layout through LibreOffice.',
    accept: '.doc,.docx,.odt,.rtf,.txt',
    extensions: ['.doc', '.docx', '.odt', '.rtf', '.txt'],
    family: 'writer',
    filterName: 'writer_pdf_Export',
  },
  {
    id: 'excel-to-pdf',
    label: 'Excel to PDF',
    description: 'XLS, XLSX, ODS, and CSV spreadsheets render as paginated PDFs locally.',
    accept: '.xls,.xlsx,.ods,.csv',
    extensions: ['.xls', '.xlsx', '.ods', '.csv'],
    family: 'calc',
    filterName: 'calc_pdf_Export',
  },
  {
    id: 'powerpoint-to-pdf',
    label: 'PowerPoint to PDF',
    description: 'PPT, PPTX, and ODP slides become PDFs without shipping presentation files off-device.',
    accept: '.ppt,.pptx,.odp',
    extensions: ['.ppt', '.pptx', '.odp'],
    family: 'impress',
    filterName: 'impress_pdf_Export',
  },
]

export function getPresetById(presetId: ConversionPresetId): ConversionPreset {
  const preset = PRESETS.find((item) => item.id === presetId)
  if (!preset) {
    throw new Error(`Unknown conversion preset: ${presetId}`)
  }

  return preset
}
