import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const dashboardSource = readFileSync(new URL('./components/Dashboard.tsx', import.meta.url), 'utf8')
const engineSource = readFileSync(new URL('./lib/brandPerformance.ts', import.meta.url), 'utf8')
describe('Brand Performance integration', () => {
  it('adds a route and module launcher', () => {
    expect(appSource).toContain("tab === 'brand-performance'")
    expect(appSource).toContain('<BrandPerformanceCentre')
    expect(appSource).toContain("changeTab('brand-performance')")
  })

  it('connects Mission Control to the brand engine', () => {
    expect(dashboardSource).toContain('calculateBrandPerformance')
    expect(dashboardSource).toContain('onOpenBrandPerformance')
  })

  it('keeps forecast-only brands from unsupported buying expansion', () => {
    expect(engineSource).toContain('if (performance.completedSales < 2)')
    expect(engineSource).toContain("recommendation: 'Hold'")
  })
})
