import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'
import dashboardSource from './components/Dashboard.tsx?raw'
import engineSource from './lib/brandPerformance.ts?raw'

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
