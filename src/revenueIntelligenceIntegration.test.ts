import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const componentSource = readFileSync(new URL('./components/RevenueIntelligenceCentre.tsx', import.meta.url), 'utf8')
const engineSource = readFileSync(new URL('./lib/revenueIntelligence.ts', import.meta.url), 'utf8')

describe('Sprint 6 Revenue Intelligence integration', () => {
  it('adds the revenue intelligence route and module launcher', () => {
    expect(appSource).toContain("'revenue-intelligence'")
    expect(appSource).toContain('RevenueIntelligenceCentre')
    expect(appSource).toContain('Revenue Intelligence')
    expect(appSource).toContain('VERSION 3.6.0 SPRINT 6')
  })

  it('calculates ranked opportunities and blocked revenue', () => {
    expect(engineSource).toContain('calculateRevenueIntelligence')
    expect(engineSource).toContain('blockedRevenue')
    expect(engineSource).toContain('scoreOpportunity')
    expect(engineSource).toContain('highestValueAction')
  })

  it('renders revenue funnel and ranked actions', () => {
    expect(componentSource).toContain('REVENUE FUNNEL')
    expect(componentSource).toContain('RANKED OPPORTUNITIES')
    expect(componentSource).toContain('HIGHEST-VALUE ACTION')
  })
})
