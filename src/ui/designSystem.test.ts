import { describe, expect, it } from 'vitest'
import buttonSource from './JosButton.tsx?raw'
import kpiSource from './KpiCard.tsx?raw'
import inventorySource from '../components/Inventory.tsx?raw'
import dashboardSource from '../components/Dashboard.tsx?raw'

describe('JOS Design System foundation', () => {
  it('provides shared button and KPI components', () => {
    expect(buttonSource).toContain('jos-button')
    expect(kpiSource).toContain('jos-kpi-card')
  })

  it('is used by Mission Control and Inventory', () => {
    expect(dashboardSource).toContain('<KpiCard')
    expect(inventorySource).toContain('<KpiCard')
    expect(inventorySource).toContain('<NoticeCard')
    expect(inventorySource).toContain('<EmptyState')
  })
})
