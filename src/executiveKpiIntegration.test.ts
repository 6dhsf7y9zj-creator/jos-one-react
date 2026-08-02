import { describe, expect, it } from 'vitest'
import dashboardSource from './components/Dashboard.tsx?raw'
import engineSource from './lib/executiveKpis.ts?raw'

describe('Executive KPI integration', () => {
  it('uses the central KPI engine on Mission Control', () => {
    expect(dashboardSource).toContain('calculateExecutiveKpis')
    expect(dashboardSource).toContain('Cash available to reinvest')
    expect(dashboardSource).toContain('Average days to sell')
  })

  it('separates forecast from realised results', () => {
    expect(engineSource).toContain('forecastGrossProfit')
    expect(engineSource).toContain('realisedOperatingProfit')
    expect(engineSource).toContain('confidenceReason')
  })
})
