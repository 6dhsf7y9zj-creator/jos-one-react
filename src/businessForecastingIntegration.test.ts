import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const dashboardSource = readFileSync(new URL('./components/Dashboard.tsx', import.meta.url), 'utf8')
const financeSource = readFileSync(new URL('./components/FinanceCommandCentre.tsx', import.meta.url), 'utf8')
const engineSource = readFileSync(new URL('./lib/businessForecasting.ts', import.meta.url), 'utf8')
describe('Business Forecasting integration', () => {
  it('adds a route and module launcher', () => {
    expect(appSource).toContain("tab === 'forecasting'")
    expect(appSource).toContain('<BusinessForecastingCentre')
    expect(appSource).toContain("changeTab('forecasting')")
  })

  it('connects Mission Control and Finance', () => {
    expect(dashboardSource).toContain('calculateBusinessForecast')
    expect(dashboardSource).toContain('Open forecasting engine')
    expect(financeSource).toContain('onOpenForecasting')
    expect(financeSource).toContain('Open forecast')
  })

  it('keeps the forecast scenario-based and reserve-controlled', () => {
    expect(engineSource).toContain('scenarioRules')
    expect(engineSource).toContain('currentTaxReserveShortfall')
    expect(engineSource).toContain('not a spending target')
    expect(engineSource).toContain('not a guarantee')
  })
})
