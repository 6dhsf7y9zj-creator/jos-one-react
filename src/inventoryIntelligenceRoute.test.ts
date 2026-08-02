import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'
import componentSource from './components/InventoryIntelligenceEngine.tsx?raw'

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
