import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const dashboardSource = readFileSync(new URL('./components/Dashboard.tsx', import.meta.url), 'utf8')
const automationSource = readFileSync(new URL('./components/AutomationCentre.tsx', import.meta.url), 'utf8')
const backupSource = readFileSync(new URL('./lib/backup.ts', import.meta.url), 'utf8')
const engineSource = readFileSync(new URL('./lib/launchCommand.ts', import.meta.url), 'utf8')
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
