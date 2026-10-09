import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { unzipSync } from 'fflate'
import { PDFDocument } from 'pdf-lib'
import { createDocxFixture, createPngFixture, createPptxFixture, createXlsxFixture } from './fixtures'

const docx = createDocxFixture()
const xlsx = createXlsxFixture()
const pptx = createPptxFixture()
const png = createPngFixture()

async function download(page: Page, click: () => Promise<void>) {
  const [file] = await Promise.all([page.waitForEvent('download'), click()])
  return { name: file.suggestedFilename(), bytes: await readFile(await file.path()) }
}

async function pageSizes(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes)
  return doc.getPages().map((item) => {
    const { width, height } = item.getSize()
    return [Math.round(width), Math.round(height)]
  })
}

function row(page: Page, name: string) {
  return page.getByRole('listitem').filter({ hasText: name })
}

async function convert(page: Page, count: number) {
  await page.getByRole('button', { name: count > 1 ? `Convert ${count} files` : 'Convert to PDF' }).click()
  await expect(page.getByText(`${count} of ${count} converted`)).toBeVisible({ timeout: 240_000 })
}

test('converts documents and images locally with every page layout', async ({ page }) => {
  const leaks: string[] = []
  page.on('request', (request) => {
    if (request.method() !== 'GET') {
      leaks.push(`${request.method()} ${request.url()}`)
    }
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Libre Convert' })).toBeVisible()

  // Original layout keeps each file's own page setup.
  await page.locator('input[type="file"]').setInputFiles([docx, xlsx, pptx, png])
  await convert(page, 4)

  const original = async (name: string) => {
    const file = await download(page, () => row(page, name).getByRole('button', { name: 'Download' }).click())
    expect(file.name).toBe(name.replace(/\.\w+$/, '.pdf'))
    return pageSizes(file.bytes)
  }
  expect(await original(docx.name)).toEqual([[612, 792]]) // US Letter from the fixture
  expect(await original(pptx.name)).toEqual([[720, 540]]) // 4:3 slide
  expect(await original(png.name)).toEqual([[2, 1]]) // 2x1 px at 96 dpi = 1.5x0.75 pt
  const [[sheetWidth, sheetHeight]] = await original(xlsx.name)
  expect(sheetHeight).toBeGreaterThan(sheetWidth)

  const zip = await download(page, () => page.getByRole('button', { name: 'Download all' }).click())
  expect(Object.keys(unzipSync(zip.bytes)).sort()).toEqual(['smoke.pdf', 'smoke (2).pdf', 'smoke (3).pdf', 'smoke (4).pdf'].sort())

  const merged = await download(page, () => page.getByRole('button', { name: 'Merge into one PDF' }).click())
  expect(await pageSizes(merged.bytes)).toHaveLength(4)

  // Landscape: text and sheets re-paginate natively, slides are fitted onto A4.
  await page.getByRole('button', { name: 'Clear' }).click()
  await page.getByRole('combobox', { name: /page layout/i }).selectOption('landscape')
  await page.locator('input[type="file"]').setInputFiles([docx, xlsx, pptx])
  await convert(page, 3)

  const landscape = async (name: string) =>
    pageSizes((await download(page, () => row(page, name).getByRole('button', { name: 'Download' }).click())).bytes)
  expect(await landscape(docx.name)).toEqual([[792, 612]])
  expect(await landscape(pptx.name)).toEqual([[842, 595]])
  const [[landscapeWidth, landscapeHeight]] = await landscape(xlsx.name)
  expect(landscapeWidth).toBeGreaterThan(landscapeHeight)

  // Portrait turns the slide deck into A4 portrait pages.
  await page.getByRole('button', { name: 'Clear' }).click()
  await page.getByRole('combobox', { name: /page layout/i }).selectOption('portrait')
  await page.locator('input[type="file"]').setInputFiles([pptx])
  await convert(page, 1)
  expect(await landscape(pptx.name)).toEqual([[595, 842]])

  expect(leaks).toEqual([])
})
