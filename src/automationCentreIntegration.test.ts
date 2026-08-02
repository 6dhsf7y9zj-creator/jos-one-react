import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'
import dashboardSource from './components/Dashboard.tsx?raw'
import centreSource from './components/AutomationCentre.tsx?raw'
import backupSource from './lib/backup.ts?raw'

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
