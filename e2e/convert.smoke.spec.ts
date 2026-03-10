import { expect, test } from '@playwright/test'
import { createDocxFixture, createPptxFixture, createXlsxFixture } from './fixtures'

test.describe('browser-only conversions', () => {
  for (const fixture of [createDocxFixture(), createXlsxFixture(), createPptxFixture()]) {
    test(`converts ${fixture.name} without uploading to a server`, async ({ page }) => {
      const requests: string[] = []

      page.on('request', (request) => {
        if (request.method() !== 'GET' && !request.url().startsWith('http://127.0.0.1:4173')) {
          requests.push(`${request.method()} ${request.url()}`)
        }
      })

      await page.goto('/')

      await expect(page.getByRole('heading', { name: /convert to pdf/i })).toBeVisible()

      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles({
        name: fixture.name,
        mimeType: fixture.mimeType,
        buffer: fixture.buffer,
      })
      await page.locator('.toolbar').getByRole('button', { name: /convert to pdf/i }).click()

      await expect(page.getByRole('link', { name: /download/i })).toBeVisible({
        timeout: 180_000,
      })

      const downloadLink = page.getByRole('link', { name: /download/i })
      await expect(downloadLink).toHaveAttribute('download', fixture.name.replace(/\.[^.]+$/, '.pdf'))
      await expect(page.getByText(/PDF ready for download/i)).toBeVisible()
      expect(requests).toEqual([])
    })
  }
})
