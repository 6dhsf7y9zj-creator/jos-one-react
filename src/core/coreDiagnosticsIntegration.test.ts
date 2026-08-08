import { describe, expect, it } from 'vitest'
import diagnosticsSource from '../components/CoreDiagnosticsCentre.tsx?raw'
import appSource from '../App.tsx?raw'

describe('Core diagnostics Sprint 3 integration', () => {
  it('publishes Data Hub, relationship inspector and audit trail views', () => {
    expect(diagnosticsSource).toContain('PUBLISHED DATA HUB')
    expect(diagnosticsSource).toContain('SKU RELATIONSHIP INSPECTOR')
    expect(diagnosticsSource).toContain('getBusinessAuditTrail')
    expect(diagnosticsSource).toContain('inspectRelationships')
  })

  it('adds diagnostics to routing and command centres', () => {
    expect(appSource).toContain("diagnostics: 'Core Diagnostics Centre'")
    expect(appSource).toContain("tab === 'diagnostics'")
    expect(appSource).toContain('Core Diagnostics')
  })
})
