import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const dashboardSource = readFileSync(new URL('./components/Dashboard.tsx', import.meta.url), 'utf8')
const reviewSource = readFileSync(new URL('./components/CeoReviewCentre.tsx', import.meta.url), 'utf8')
const engineSource = readFileSync(new URL('./lib/ceoRecommendations.ts', import.meta.url), 'utf8')
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
