import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const dashboardSource = readFileSync(new URL('./components/Dashboard.tsx', import.meta.url), 'utf8')
const engineSource = readFileSync(new URL('./lib/executiveKpis.ts', import.meta.url), 'utf8')
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
