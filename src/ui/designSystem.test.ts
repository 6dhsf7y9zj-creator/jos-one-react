import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const buttonSource = readFileSync(new URL('./JosButton.tsx', import.meta.url), 'utf8')
const kpiSource = readFileSync(new URL('./KpiCard.tsx', import.meta.url), 'utf8')
const inventorySource = readFileSync(new URL('../components/Inventory.tsx', import.meta.url), 'utf8')
const dashboardSource = readFileSync(new URL('../components/Dashboard.tsx', import.meta.url), 'utf8')
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
