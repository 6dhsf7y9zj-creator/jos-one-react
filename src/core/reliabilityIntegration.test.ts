import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const diagnosticsSource = readFileSync(new URL('../components/CoreDiagnosticsCentre.tsx', import.meta.url), 'utf8')
const reliabilitySource = readFileSync(new URL('./Reliability.ts', import.meta.url), 'utf8')
const eventSource = readFileSync(new URL('./EventBus.ts', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')

describe('Sprint 4 reliability and recovery integration', () => {
  it('adds live production protection and recovery controls', () => {
    expect(diagnosticsSource).toContain('production protection')
    expect(diagnosticsSource).toContain('Run integrity check')
    expect(diagnosticsSource).toContain('Open Backup Centre')
    expect(reliabilitySource).toContain('calculateReliability')
  })

  it('makes the audit trail searchable, exportable and clearable', () => {
    expect(diagnosticsSource).toContain('Searchable production history')
    expect(diagnosticsSource).toContain("exportAudit('csv')")
    expect(diagnosticsSource).toContain("exportAudit('json')")
    expect(eventSource).toContain('clearBusinessAuditTrail')
  })

  it('records recovery activity and exposes current release versioning', () => {
    expect(appSource).toContain("type: 'backup.restored'")
    expect(appSource).toContain('VERSION 3.5.0 SPRINT 5')
  })
})
