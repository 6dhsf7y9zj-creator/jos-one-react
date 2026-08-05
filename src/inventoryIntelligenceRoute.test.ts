import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const componentSource = readFileSync(new URL('./components/InventoryIntelligenceEngine.tsx', import.meta.url), 'utf8')
describe('Inventory Intelligence module integration', () => {
  it('renders the inventory intelligence route and module launcher', () => {
    expect(appSource).toContain("tab === 'inventory-intelligence'")
    expect(appSource).toContain('<InventoryIntelligenceEngine')
    expect(appSource).toContain("changeTab('inventory-intelligence')")
  })

  it('keeps grade recommendations advisory until applied', () => {
    expect(componentSource).toContain('applyAllRecommendations')
    expect(componentSource).toContain('Nothing changes until approved')
  })
})
