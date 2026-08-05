import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const centreSource = readFileSync(new URL('./components/ProductionReadinessCentre.tsx', import.meta.url), 'utf8')
const engineSource = readFileSync(new URL('./core/ReleaseReadiness.ts', import.meta.url), 'utf8')

describe('Production Readiness integration', () => {
  it('adds a production readiness route and module launcher', () => {
    expect(appSource).toContain("'production-readiness'")
    expect(appSource).toContain('<ProductionReadinessCentre')
    expect(appSource).toContain('Production Readiness')
  })

  it('uses controlled release gates', () => {
    expect(engineSource).toContain('calculateReleaseReadiness')
    expect(engineSource).toContain("label: 'Recovery protection'")
    expect(engineSource).toContain("label: 'Cross-module relationships'")
  })

  it('provides resolution routes for failed gates', () => {
    expect(centreSource).toContain('Open Backup Centre')
    expect(centreSource).toContain('Open Core Diagnostics')
    expect(centreSource).toContain('Resolve')
  })
})
