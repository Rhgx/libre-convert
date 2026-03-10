import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Presentation,
  Trash2,
  Upload,
} from 'lucide-react'
import './App.css'
import {
  createConversionJob,
  getAcceptedFileTypes,
  getSupportedExtensions,
  normalizePdfName,
  validateFilesForAutoDetect,
} from './lib/files'
import { createLibreOfficeClient, type ConversionService } from './lib/libreOfficeClient'
import { queueReducer } from './lib/queueReducer'
import type { ConversionJob, ConversionJobStatus } from './types/conversion'

type AppProps = {
  service?: ConversionService
}

const iconByPreset = {
  'word-to-pdf': FileText,
  'excel-to-pdf': FileSpreadsheet,
  'powerpoint-to-pdf': Presentation,
} as const

const acceptedFileTypes = getAcceptedFileTypes()
const supportedExtensions = getSupportedExtensions()

function App({ service }: AppProps) {
  const [jobs, dispatch] = useReducer(queueReducer, [])
  const [notice, setNotice] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [engineState, setEngineState] = useState<'idle' | 'booting' | 'ready' | 'error'>('idle')
  const [engineError, setEngineError] = useState<string | null>(null)
  const [processingEnabled, setProcessingEnabled] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const serviceRef = useRef<ConversionService>(service ?? createLibreOfficeClient())
  const processingJobIdRef = useRef<string | null>(null)
  const jobsRef = useRef<ConversionJob[]>(jobs)

  useEffect(() => {
    jobsRef.current = jobs
  }, [jobs])

  const queuedJobs = jobs.filter((job) => job.status === 'queued')
  const activeJob = jobs.find((job) => job.status === 'initializing' || job.status === 'converting') ?? null
  const completedJobs = jobs.filter((job) => job.status === 'ready').length
  const globalProgress = getGlobalProgress(jobs)
  const crossOriginReady = window.crossOriginIsolated

  const updateJobStatus = useEffectEvent((jobId: string, status: ConversionJobStatus, message?: string) => {
    dispatch({
      type: 'status',
      jobId,
      status,
      message,
    })
  })

  const enqueueFiles = useEffectEvent((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) {
      return
    }

    const validation = validateFilesForAutoDetect(fileArray)

    if (validation.invalid.length > 0) {
      const invalidNames = validation.invalid.map((item) => item.file.name).join(', ')
      setNotice(`Unsupported file types: ${invalidNames}. Supported formats: ${supportedExtensions.join(', ')}.`)
    } else {
      setNotice(null)
    }

    if (validation.valid.length === 0) {
      return
    }

    dispatch({
      type: 'enqueue',
      jobs: validation.valid.map(({ file, preset }) => createConversionJob(file, preset.id)),
    })
  })

  useEffect(() => {
    return () => {
      for (const job of jobsRef.current) {
        if (job.downloadUrl) {
          URL.revokeObjectURL(job.downloadUrl)
        }
      }
    }
  }, [])

  useEffect(() => {
    const hasActiveJob = jobs.some((job) => job.status === 'initializing' || job.status === 'converting')

    if (processingJobIdRef.current && !hasActiveJob) {
      processingJobIdRef.current = null
    }

    if (!processingEnabled) {
      return
    }

    if (processingJobIdRef.current) {
      return
    }

    const nextJob = jobs.find((job) => job.status === 'queued')
    if (!nextJob) {
      setProcessingEnabled(false)
      return
    }

    processingJobIdRef.current = nextJob.id

    void (async () => {
      try {
        setEngineError(null)
        updateJobStatus(nextJob.id, 'initializing')
        if (engineState === 'idle') {
          setEngineState('booting')
        }

        const pdfBuffer = await serviceRef.current.convert({
          jobId: nextJob.id,
          file: nextJob.file,
          presetId: nextJob.presetId,
          onStatus: (status, message) => {
            if (status === 'initializing') {
              setEngineState('booting')
            }
            if (status === 'converting') {
              setEngineState('ready')
            }
            updateJobStatus(nextJob.id, status, message)
          },
        })

        const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
        const downloadUrl = URL.createObjectURL(blob)
        dispatch({
          type: 'success',
          jobId: nextJob.id,
          downloadUrl,
          outputFileName: normalizePdfName(nextJob.file.name),
        })
        setEngineState('ready')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Conversion failed unexpectedly.'
        setEngineState('error')
        setEngineError(message)
        updateJobStatus(nextJob.id, 'error', message)
      } finally {
        processingJobIdRef.current = null
      }
    })()
  }, [engineState, jobs, processingEnabled, updateJobStatus])

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      enqueueFiles(event.target.files)
      event.target.value = ''
    }
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragActive(false)

    if (event.dataTransfer.files.length > 0) {
      enqueueFiles(event.dataTransfer.files)
    }
  }

  function handleRemove(job: ConversionJob) {
    if (job.downloadUrl) {
      URL.revokeObjectURL(job.downloadUrl)
    }
    dispatch({ type: 'remove', jobId: job.id })
  }

  function handleConvertClick() {
    if (queuedJobs.length === 0) {
      return
    }

    setNotice(null)
    setProcessingEnabled(true)
  }

  return (
    <main className="shell">
      <canvas id="qtcanvas" className="qt-canvas" aria-hidden="true" />

      <section className="converter-card">
        <header className="converter-header">
          <h1>Convert to PDF</h1>
        </header>

        <label
          className={`dropzone ${dragActive ? 'dropzone--active' : ''}`}
          onDragEnter={(event) => {
            event.preventDefault()
            setDragActive(true)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            setDragActive(false)
          }}
          onDrop={handleDrop}
        >
          <div className="dropzone-badge">
            <Upload size={18} />
          </div>
          <strong>Drag files here</strong>
          <p>or click to choose supported documents. Format is detected automatically.</p>
          <span className="dropzone-hint">{supportedExtensions.join(', ')}</span>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            multiple
            accept={acceptedFileTypes}
            onChange={handleFileInputChange}
          />
        </label>

        <div className="action-row">
          <button
            type="button"
            className="button button--primary"
            onClick={handleConvertClick}
            disabled={queuedJobs.length === 0 || processingEnabled}
          >
            {processingEnabled ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}
            {processingEnabled ? 'Converting' : 'Convert to PDF'}
          </button>
        </div>

        {(notice || engineError || !crossOriginReady) && (
          <div className="callout">
            <AlertTriangle size={18} />
            <div>
              {!crossOriginReady && (
                <p>
                  Cross-origin isolation is required. This app will try to enable it automatically with a service
                  worker on secure static hosting such as GitHub Pages. If conversion stays blocked after reload, the
                  browser still is not isolated and the site must be served over HTTPS with `COOP/COEP` support.
                </p>
              )}
              {notice && <p>{notice}</p>}
              {engineError && <p>{engineError}</p>}
            </div>
          </div>
        )}

        {jobs.length > 0 && (
          <section className="progress-panel" aria-label="Conversion progress">
            <div className="progress-head">
              <div>
                <p className="panel-label">Progress</p>
                <strong>{activeJob ? `Working on ${activeJob.file.name}` : `${completedJobs} ready`}</strong>
              </div>
              <span className={`engine-pill engine-pill--${engineState}`}>{getEngineLabel(engineState)}</span>
            </div>

            <div className="progress-track" aria-hidden="true">
              <span style={{ width: `${globalProgress}%` }} />
            </div>
          </section>
        )}

        {jobs.length === 0 ? (
          <section className="empty-state">
            <p>Upload one or more files, then press convert.</p>
          </section>
        ) : (
          <ul className="job-list">
            {jobs.map((job) => {
              const Icon = iconByPreset[job.presetId]
              const progressValue = getJobProgress(job.status)
              const isFinished = job.status === 'ready' || job.status === 'error'

              return (
                <li key={job.id} className={`job-card job-card--${job.status}`}>
                  <div className="job-main">
                    <div className="job-icon">
                      <Icon size={18} />
                    </div>
                    <div className="job-copy">
                      <div className="job-topline">
                        <strong>{job.file.name}</strong>
                        <span>{formatBytes(job.file.size)}</span>
                      </div>
                      <p>{job.message ?? job.statusLabel}</p>
                    </div>
                  </div>

                  <div className="job-progress">
                    <div className="job-progress-bar" aria-hidden="true">
                      <span
                        className={
                          job.status === 'error'
                            ? 'job-progress-bar__fill job-progress-bar__fill--error'
                            : 'job-progress-bar__fill'
                        }
                        style={{ width: `${progressValue}%` }}
                      />
                    </div>
                    <span>{job.status === 'ready' ? 'Done' : job.status === 'error' ? 'Failed' : `${progressValue}%`}</span>
                  </div>

                  <div className="job-actions">
                    {job.status === 'ready' && job.downloadUrl ? (
                      <a className="button button--ghost" href={job.downloadUrl} download={job.outputFileName}>
                        <Download size={15} />
                        Download
                      </a>
                    ) : (
                      <span className={`status-chip status-chip--${job.status}`}>
                        {job.status === 'converting' || job.status === 'initializing' ? (
                          <LoaderCircle className="spin" size={14} />
                        ) : job.status === 'ready' ? (
                          <CheckCircle2 size={14} />
                        ) : job.status === 'error' ? (
                          <AlertTriangle size={14} />
                        ) : (
                          <Upload size={14} />
                        )}
                        {job.statusLabel}
                      </span>
                    )}

                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove ${job.file.name}`}
                      onClick={() => handleRemove(job)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {isFinished && job.message && <p className="job-note">{job.message}</p>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getJobProgress(status: ConversionJobStatus): number {
  switch (status) {
    case 'queued':
      return 8
    case 'initializing':
      return 42
    case 'converting':
      return 78
    case 'ready':
      return 100
    case 'error':
      return 100
  }
}

function getGlobalProgress(jobs: ConversionJob[]): number {
  if (jobs.length === 0) {
    return 0
  }

  const total = jobs.reduce((sum, job) => sum + getJobProgress(job.status), 0)
  return Math.round(total / jobs.length)
}

function getEngineLabel(state: 'idle' | 'booting' | 'ready' | 'error'): string {
  switch (state) {
    case 'idle':
      return 'Idle'
    case 'booting':
      return 'Loading engine'
    case 'ready':
      return 'Ready'
    case 'error':
      return 'Blocked'
  }
}

export default App
