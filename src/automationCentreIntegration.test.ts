import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const dashboardSource = readFileSync(new URL('./components/Dashboard.tsx', import.meta.url), 'utf8')
const centreSource = readFileSync(new URL('./components/AutomationCentre.tsx', import.meta.url), 'utf8')
const backupSource = readFileSync(new URL('./lib/backup.ts', import.meta.url), 'utf8')
describe('Automation Centre integration', () => {
  it('adds a route and module launcher', () => {
    expect(appSource).toContain("tab === 'automation'")
    expect(appSource).toContain('<AutomationCentre')
    expect(appSource).toContain("changeTab('automation')")
  })

  it('connects Mission Control to automation status', () => {
    expect(dashboardSource).toContain('calculateAutomationReport')
    expect(dashboardSource).toContain('Open Automation Centre')
    expect(dashboardSource).toContain('onOpenAutomation')
  })

  it('states the in-app execution boundary', () => {
    expect(centreSource).toContain('does not run background')
    expect(centreSource).toContain('while the browser is closed')
  })

  it('preserves automation and target data during backup migration', () => {
    expect(backupSource).toContain('monthlyProfitTarget')
    expect(backupSource).toContain('normaliseAutomationSettings')
  })
})
