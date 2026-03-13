import type { PageOrientation } from '../types/conversion'

type PropertySetLike = {
  getPropertyValue(name: string): unknown
  setPropertyValue(name: string, value: unknown): void
}

type NameAccessLike = {
  getByName(name: string): unknown
  getElementNames(): string[]
}

type SpreadsheetDocumentLike = {
  getSheets(): NameAccessLike
}

type StyleFamiliesSupplierLike = {
  getStyleFamilies(): NameAccessLike
}

export function configureCalcPrintLayout(
  document: SpreadsheetDocumentLike,
  styleFamiliesSupplier: StyleFamiliesSupplierLike,
  orientation: PageOrientation,
) {
  const sheets = document.getSheets()
  const styleFamilies = styleFamiliesSupplier.getStyleFamilies()
  const pageStyles = styleFamilies.getByName('PageStyles') as NameAccessLike
  const pageStyleNames = new Set<string>()

  for (const sheetName of sheets.getElementNames()) {
    const sheet = sheets.getByName(sheetName) as PropertySetLike
    const pageStyleName = sheet.getPropertyValue('PageStyle')

    if (typeof pageStyleName === 'string' && pageStyleName.length > 0) {
      pageStyleNames.add(pageStyleName)
    }
  }

  for (const pageStyleName of pageStyleNames) {
    const pageStyle = pageStyles.getByName(pageStyleName) as PropertySetLike

    pageStyle.setPropertyValue('IsLandscape', orientation === 'horizontal')

    if (orientation === 'horizontal') {
      // Fit the used columns onto one page width so wide sheets do not fragment across portrait pages.
      safelySetProperty(pageStyle, 'PageScale', 0)
      safelySetProperty(pageStyle, 'ScaleToPages', 0)
      safelySetProperty(pageStyle, 'ScaleToPagesX', 1)
      safelySetProperty(pageStyle, 'ScaleToPagesY', 0)
    }
  }
}

function safelySetProperty(target: PropertySetLike, name: string, value: unknown) {
  try {
    target.setPropertyValue(name, value)
  } catch {
    // Some spreadsheet variants omit certain print-scaling properties.
  }
}
