import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'
import dashboardSource from './components/Dashboard.tsx?raw'
import automationSource from './components/AutomationCentre.tsx?raw'
import backupSource from './lib/backup.ts?raw'
import engineSource from './lib/launchCommand.ts?raw'

describe('January 2027 Launch Command Centre integration', () => {
  it('adds a route and module launcher', () => {
    expect(appSource).toContain("tab === 'launch-command'")
    expect(appSource).toContain('<LaunchCommandCentre')
    expect(appSource).toContain("changeTab('launch-command')")
  })

  it('connects Mission Control and Automation Centre', () => {
    expect(dashboardSource).toContain('calculateLaunchCommandReport')
    expect(dashboardSource).toContain('Open Launch Command Centre')
    expect(automationSource).toContain('onOpenLaunchCommand')
    expect(automationSource).toContain('Open Launch Command Centre')
  })

  it('preserves launch-command settings in backups', () => {
    expect(backupSource).toContain('normaliseLaunchCommandSettings')
    expect(backupSource).toContain('launchCommand:')
  })

  it('keeps launch readiness controlled and non-automatic', () => {
    expect(engineSource).toContain('Exit-grade stock is excluded')
    expect(engineSource).toContain('require manual confirmation')
    expect(engineSource).toContain('never publishes posts')
  })
})
