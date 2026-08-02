import { describe, expect, it } from 'vitest'
import type { InventoryBrandIntelligence } from './inventoryIntelligence'

describe('Inventory Intelligence brand evidence typing', () => {
  it('only permits recognised evidence states', () => {
    const values: InventoryBrandIntelligence['evidence'][] = [
      'forecast-only',
      'limited',
      'developing',
    ]
    expect(values).toEqual(['forecast-only', 'limited', 'developing'])
  })
})
