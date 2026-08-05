import { describe, expect, it } from 'vitest'
import { expectedProfit, generateSku, nextStatus } from './inventory.ts'
import type { InventoryItem } from '../types/inventory.ts'

const item: InventoryItem = {
  sku: 'JAE-0007',
  brand: 'Nike',
  category: 'Hoodie',
  description: 'Nike hoodie',
  size: 'M',
  condition: 'Very good',
  status: 'Prep',
  grade: 'B',
  purchasePrice: 6,
  expectedSalePrice: 28,
  storageLocation: 'A1',
}

describe('inventory logic', () => {
  it('calculates profit', () => expect(expectedProfit(item)).toBe(22))
  it('generates next sku', () => expect(generateSku([item])).toBe('JAE-0008'))
  it('advances status', () => expect(nextStatus('Prep')).toBe('Photographed'))
})
