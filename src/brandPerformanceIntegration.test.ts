import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'
import dashboardSource from './components/Dashboard.tsx?raw'
import centreSource from './components/BrandPerformanceCentre.tsx?raw'

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
    expect(centreSource).toContain('Forecast-only brands remain Hold')
  })
})
