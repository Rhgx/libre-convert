import { describe, expect, it } from 'vitest'
import { configureCalcPrintLayout } from './calcPrintLayout'

describe('configureCalcPrintLayout', () => {
  it('applies landscape fit-to-width settings to each unique sheet page style', () => {
    const defaultStyle = createPropertySet()
    const summaryStyle = createPropertySet()

    configureCalcPrintLayout(
      {
        getSheets: () =>
          createNameAccess({
            Budget: createPropertySet({ PageStyle: 'Default' }),
            Forecast: createPropertySet({ PageStyle: 'Default' }),
            Summary: createPropertySet({ PageStyle: 'Summary' }),
          }),
      },
      {
        getStyleFamilies: () =>
          createNameAccess({
            PageStyles: createNameAccess({
              Default: defaultStyle,
              Summary: summaryStyle,
            }),
          }),
      },
      'horizontal',
    )

    expect(defaultStyle.setCalls).toEqual([
      ['IsLandscape', true],
      ['PageScale', 0],
      ['ScaleToPages', 0],
      ['ScaleToPagesX', 1],
      ['ScaleToPagesY', 0],
    ])
    expect(summaryStyle.setCalls).toEqual([
      ['IsLandscape', true],
      ['PageScale', 0],
      ['ScaleToPages', 0],
      ['ScaleToPagesX', 1],
      ['ScaleToPagesY', 0],
    ])
  })

  it('switches spreadsheet styles back to portrait without overwriting scaling rules', () => {
    const defaultStyle = createPropertySet()

    configureCalcPrintLayout(
      {
        getSheets: () =>
          createNameAccess({
            Budget: createPropertySet({ PageStyle: 'Default' }),
          }),
      },
      {
        getStyleFamilies: () =>
          createNameAccess({
            PageStyles: createNameAccess({
              Default: defaultStyle,
            }),
          }),
      },
      'vertical',
    )

    expect(defaultStyle.setCalls).toEqual([['IsLandscape', false]])
  })
})

function createNameAccess(entries: Record<string, unknown>) {
  return {
    getByName(name: string) {
      return entries[name]
    },
    getElementNames() {
      return Object.keys(entries)
    },
  }
}

function createPropertySet(initialValues: Record<string, unknown> = {}) {
  const values = new Map(Object.entries(initialValues))
  const setCalls: Array<[string, unknown]> = []

  return {
    setCalls,
    getPropertyValue(name: string) {
      return values.get(name)
    },
    setPropertyValue(name: string, value: unknown) {
      values.set(name, value)
      setCalls.push([name, value])
    },
  }
}
