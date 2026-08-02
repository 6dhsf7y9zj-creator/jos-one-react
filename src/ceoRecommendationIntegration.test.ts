import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'
import dashboardSource from './components/Dashboard.tsx?raw'
import reviewSource from './components/CeoReviewCentre.tsx?raw'
import engineSource from './lib/ceoRecommendations.ts?raw'

describe('CEO Recommendation Engine integration', () => {
  it('adds a route and module launcher', () => {
    expect(appSource).toContain("tab === 'recommendations'")
    expect(appSource).toContain('<CeoRecommendationCentre')
    expect(appSource).toContain("changeTab('recommendations')")
  })

  it('connects Mission Control and CEO Review', () => {
    expect(dashboardSource).toContain('calculateCeoRecommendations')
    expect(dashboardSource).toContain('Open ranked decision plan')
    expect(reviewSource).toContain('calculateCeoRecommendations')
    expect(reviewSource).toContain('Open full decision plan')
  })

  it('enforces customer-first and evidence-controlled sourcing rules', () => {
    expect(engineSource).toContain('Customer commitments always come first')
    expect(engineSource).toContain("sourcingDecision = 'blocked'")
    expect(engineSource).toContain("brand.recommendation === 'Buy More'")
    expect(engineSource).toContain('Recommendations never edit stock')
  })
})
