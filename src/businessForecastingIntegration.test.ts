import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'
import dashboardSource from './components/Dashboard.tsx?raw'
import financeSource from './components/FinanceCommandCentre.tsx?raw'
import engineSource from './lib/businessForecasting.ts?raw'

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
