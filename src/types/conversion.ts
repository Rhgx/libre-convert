export type ConversionPresetId = 'word-to-pdf' | 'excel-to-pdf' | 'powerpoint-to-pdf' | 'image-to-pdf'

export type PdfFilterName = 'writer_pdf_Export' | 'calc_pdf_Export' | 'impress_pdf_Export' | 'draw_pdf_Export'
export type PageOrientation = 'vertical' | 'horizontal'

export type ConversionJobStatus = 'queued' | 'initializing' | 'converting' | 'ready' | 'error'

export interface ConversionPreset {
  id: ConversionPresetId
  label: string
  description: string
  accept: string
  extensions: string[]
  family: 'writer' | 'calc' | 'impress' | 'draw'
  filterName: PdfFilterName
}

export interface ConversionJob {
  id: string
  presetId: ConversionPresetId
  file: File
  pageOrientation: PageOrientation
  status: ConversionJobStatus
  statusLabel: string
  message?: string
  downloadUrl?: string
  outputFileName?: string
}

export type WorkerRequest =
  | {
      cmd: 'init'
    }
  | {
      cmd: 'convert'
      jobId: string
      fromPath: string
      toPath: string
      presetFamily: ConversionPreset['family']
      filterName: PdfFilterName
      pageOrientation: PageOrientation
    }

export type WorkerResponse =
  | {
      cmd: 'status'
      status: 'ready' | 'initializing' | 'converting'
      jobId?: string
      message?: string
    }
  | {
      cmd: 'success'
      jobId: string
      fromPath: string
      toPath: string
    }
  | {
      cmd: 'error'
      jobId?: string
      message: string
    }

export interface ConvertFileRequest {
  jobId: string
  presetId: ConversionPresetId
  file: File
  pageOrientation?: PageOrientation
  onStatus?: (status: Extract<ConversionJobStatus, 'initializing' | 'converting'>, message?: string) => void
}
