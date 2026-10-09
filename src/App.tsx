import { useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  Archive,
  Combine,
  Download,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  LoaderCircle,
  Presentation,
  RotateCcw,
  Shapes,
  TriangleAlert,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react'
import { convertFile, preloadOffice } from './conversion/convert'
import { ACCEPT, kindOf, pdfName, uniqueNames, type Kind, type Layout } from './conversion/formats'

type Job = {
  id: number
  file: File
  kind: Kind
  status: 'queued' | 'converting' | 'done' | 'error'
  // Engine progress while converting, the reason when failed.
  note?: string
  pdf?: Blob
  // The layout the PDF was made with; shown when it differs from the current choice.
  layout?: Layout
}

type AppProps = {
  convert?: typeof convertFile
  preload?: () => void
}

const ICONS: Record<Kind, LucideIcon> = {
  writer: FileText,
  calc: FileSpreadsheet,
  impress: Presentation,
  draw: Shapes,
  image: ImageIcon,
}

const LAYOUTS: { value: Layout; label: string; hint: string }[] = [
  { value: 'original', label: 'Original', hint: "Keeps each file's own page size and orientation." },
  { value: 'portrait', label: 'Portrait', hint: 'Documents and sheets re-flow; slides and images are fitted onto A4.' },
  { value: 'landscape', label: 'Landscape', hint: 'Documents re-flow, sheets fit to page width; slides and images are fitted onto A4.' },
]

const LAYOUT_KEY = 'libre-convert:layout'
const TITLE = document.title
const SHORTCUT = /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd+Enter' : 'Ctrl+Enter'

let nextId = 0

export default function App({ convert = convertFile, preload = preloadOffice }: AppProps) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [layout, setLayout] = useState<Layout>(
    () => LAYOUTS.find((item) => item.value === window.localStorage.getItem(LAYOUT_KEY))?.value ?? 'original',
  )
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [notice, setNotice] = useState<string>()
  // The conversion loop outlives renders, so it reads and writes jobs through this ref; state mirrors it.
  const jobsRef = useRef<Job[]>([])
  const busyRef = useRef(false)

  function commit(next: Job[]) {
    jobsRef.current = next
    setJobs(next)
  }

  function patch(id: number, change: Partial<Job>) {
    commit(jobsRef.current.map((job) => (job.id === id ? { ...job, ...change } : job)))
  }

  function addFiles(files: Iterable<File>) {
    const added: Job[] = []
    const skipped: string[] = []

    for (const file of files) {
      const kind = kindOf(file.name)
      if (kind) {
        added.push({ id: nextId++, file, kind, status: 'queued' })
      } else {
        skipped.push(file.name)
      }
    }

    setNotice(skipped.length > 0 ? `Skipped unsupported files: ${skipped.join(', ')}` : undefined)
    if (added.length === 0) {
      return
    }

    commit([...jobsRef.current, ...added])
    if (added.some((job) => job.kind !== 'image')) {
      preload()
    }
  }

  async function run() {
    if (busyRef.current) {
      return
    }

    busyRef.current = true
    setBusy(true)

    // Picks up files added or retried while the loop is running.
    for (let job = findQueued(); job; job = findQueued()) {
      const { id } = job
      patch(id, { status: 'converting', note: undefined })

      try {
        const pdf = await convert(job.file, job.kind, layout, (note) => patch(id, { note }))
        patch(id, { status: 'done', note: undefined, pdf, layout })
      } catch (error) {
        patch(id, { status: 'error', note: error instanceof Error ? error.message : String(error) })
      }
    }

    busyRef.current = false
    setBusy(false)
  }

  function findQueued() {
    return jobsRef.current.find((job) => job.status === 'queued')
  }

  function retry(id: number) {
    patch(id, { status: 'queued', note: undefined })
    void run()
  }

  // Converts what is queued, or everything again (e.g. after switching the page layout).
  function convertAll() {
    if (!jobsRef.current.some((job) => job.status === 'queued')) {
      commit(jobsRef.current.map((job) => ({ ...job, status: 'queued', note: undefined, pdf: undefined, layout: undefined })))
    }
    void run()
  }

  async function downloadAll() {
    try {
      const { zipSync } = await import('fflate')
      const names = uniqueNames(outputs.map((output) => output.name))
      const entries = await Promise.all(outputs.map(async (output) => new Uint8Array(await output.pdf.arrayBuffer())))
      // PDFs are already compressed, so store them as-is.
      const zip = zipSync(Object.fromEntries(names.map((name, index) => [name, entries[index]])), { level: 0 })
      save(new Blob([zip], { type: 'application/zip' }), 'libre-convert.zip')
    } catch (error) {
      setNotice(`Could not build the ZIP: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function merge() {
    try {
      const { mergePdfs } = await import('./conversion/pdf')
      save(await mergePdfs(outputs.map((output) => output.pdf)), 'merged.pdf')
    } catch (error) {
      setNotice(`Could not merge the PDFs: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const onDrop = useEffectEvent((event: DragEvent) => {
    setDragging(false)
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault()
      addFiles(event.dataTransfer.files)
    }
  })

  const onPaste = useEffectEvent((event: ClipboardEvent) => {
    if (event.clipboardData?.files.length) {
      addFiles(event.clipboardData.files)
    }
  })

  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !busyRef.current && jobsRef.current.length > 0) {
      event.preventDefault()
      convertAll()
    }
  })

  // Files can be dropped or pasted anywhere on the page, not just on the drop zone.
  useEffect(() => {
    const handleDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) {
        event.preventDefault()
        setDragging(true)
      }
    }
    const handleDragLeave = (event: DragEvent) => {
      // relatedTarget is null only when the pointer leaves the window.
      if (!event.relatedTarget) {
        setDragging(false)
      }
    }
    const handleDrop = (event: DragEvent) => onDrop(event)
    const handlePaste = (event: ClipboardEvent) => onPaste(event)
    const handleKeyDown = (event: KeyboardEvent) => onShortcut(event)

    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)
    window.addEventListener('paste', handlePaste)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
      window.removeEventListener('paste', handlePaste)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])


  const outputs = jobs.flatMap((job) => (job.pdf ? [{ name: pdfName(job.file.name), pdf: job.pdf }] : []))
  const queued = jobs.filter((job) => job.status === 'queued').length
  const failed = jobs.filter((job) => job.status === 'error').length
  const finished = outputs.length + failed

  useEffect(() => {
    document.title = busy ? `(${finished}/${jobs.length}) ${TITLE}` : TITLE
  }, [busy, finished, jobs.length])

  return (
    <main className="shell">
      <header className="intro">
        <h1>Libre Convert</h1>
        <p>Office documents and images to PDF, entirely in your browser. Files never leave your device.</p>
      </header>

      <section className="card">
        <label className={['dropzone', jobs.length > 0 && 'dropzone--compact', dragging && 'dropzone--active'].filter(Boolean).join(' ')}>
          <span className="dropzone-badge">
            <Upload size={jobs.length > 0 ? 16 : 18} />
          </span>
          <strong>{jobs.length > 0 ? 'Add more files' : 'Drop files here'}</strong>
          <span className="muted">
            {jobs.length > 0 ? 'Drop, click or paste' : 'or click to choose. Pasting images works too.'}
          </span>
          <input
            className="sr-only"
            type="file"
            multiple
            accept={ACCEPT}
            onChange={(event) => {
              addFiles(event.target.files ?? [])
              event.target.value = ''
            }}
          />
        </label>

        {jobs.length > 0 && (
          <div className="toolbar">
            <label className="field">
              <span className="label">Page layout</span>
              <select
                value={layout}
                disabled={busy}
                onChange={(event) => {
                  const value = LAYOUTS.find((item) => item.value === event.target.value)?.value ?? 'original'
                  setLayout(value)
                  window.localStorage.setItem(LAYOUT_KEY, value)
                }}
              >
                {LAYOUTS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">{LAYOUTS.find((item) => item.value === layout)?.hint}</p>
            <button
              type="button"
              className="button button--primary"
              disabled={busy}
              title={SHORTCUT}
              onClick={convertAll}
            >
              {busy ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}
              {busy
                ? `Converting ${Math.min(finished + 1, jobs.length)} of ${jobs.length}`
                : queued > 1
                  ? `Convert ${queued} files`
                  : queued === 1
                    ? 'Convert to PDF'
                    : 'Convert all again'}
            </button>
          </div>
        )}

        {notice && (
          <p className="callout">
            <TriangleAlert size={16} />
            {notice}
          </p>
        )}

        {jobs.length === 0 ? (
          <p className="empty">Documents, spreadsheets, slides and images.</p>
        ) : (
          <>
            <ul className="jobs">
              {jobs.map((job) => {
                const Icon = ICONS[job.kind]
                const { pdf } = job
                return (
                  <li key={job.id} className="job">
                    <span className="job-icon">
                      <Icon size={18} />
                    </span>
                    <div className="job-copy">
                      <div className="job-name">
                        <strong title={job.file.name}>{job.file.name}</strong>
                        <span className="mono">{formatBytes(job.file.size)}</span>
                      </div>
                      {job.status !== 'queued' && (
                        <p className={job.status === 'error' ? 'job-status job-status--error' : 'job-status'}>
                          {statusText(job, layout)}
                        </p>
                      )}
                      {job.status === 'converting' && <span className="bar" aria-hidden="true" />}
                    </div>
                    <div className="job-actions">
                      {pdf && (
                        <button type="button" className="button" onClick={() => save(pdf, pdfName(job.file.name))}>
                          <Download size={15} />
                          <span className="button-label">Download</span>
                        </button>
                      )}
                      {job.status === 'error' && (
                        <button type="button" className="button" onClick={() => retry(job.id)}>
                          <RotateCcw size={15} />
                          <span className="button-label">Retry</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remove ${job.file.name}`}
                        onClick={() => commit(jobsRef.current.filter((item) => item.id !== job.id))}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="footer">
              <span className="mono muted" aria-live="polite">
                {finished === 0 && !busy
                  ? `${jobs.length} ${jobs.length === 1 ? 'file' : 'files'}`
                  : `${outputs.length} of ${jobs.length} converted${failed > 0 ? `, ${failed} failed` : ''}`}
              </span>
              <button type="button" className="link" onClick={() => commit([])}>
                Clear
              </button>
              <div className="footer-actions">
                {outputs.length > 1 && (
                  <>
                    <button type="button" className="button" onClick={() => void downloadAll()}>
                      <Archive size={15} />
                      Download all
                    </button>
                    <button type="button" className="button" onClick={() => void merge()}>
                      <Combine size={15} />
                      Merge into one PDF
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <span>Drop to add files</span>
        </div>
      )}
    </main>
  )
}

function statusText(job: Job, currentLayout: Layout): string {
  switch (job.status) {
    case 'queued':
      return ''
    case 'converting':
      return job.note ?? 'Converting'
    case 'done': {
      const size = job.pdf ? `, ${formatBytes(job.pdf.size)}` : ''
      const made = job.layout && job.layout !== currentLayout ? ` (${job.layout})` : ''
      return `PDF ready${size}${made}`
    }
    case 'error':
      return job.note ?? 'Conversion failed'
  }
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  // Revoking right away can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
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
