import { describe, expect, it } from 'vitest'
import type { InventoryItem, JosSettings } from '../types/inventory.ts'
import { saveInventoryThroughCore } from './JOSCore.ts'
import { calculateSystemHealth } from './SystemHealth.ts'
import { inspectRelationships } from './RelationshipEngine.ts'

const settings: JosSettings = {
  minimumProfit: 15,
  targetRoi: 150,
  storageLocations: ['A1'],
  finance: {
    openingCash: 0,
    emergencyReserve: 0,
    plannedSourcingBudget: 0,
    taxPlanningRate: 20,
    transactions: [],
  },
}
const item: InventoryItem = {
  sku: 'JAE-1', brand: 'Nike', category: 'Hoodie', description: 'Test', size: 'M',
  condition: 'Good', status: 'Live', grade: 'B', purchasePrice: 10,
  expectedSalePrice: 30, storageLocation: 'A1',
}

describe('JOS Core Sprint 1', () => {
  it('saves an inventory update and migrates linked records on SKU change', () => {
    const result = saveInventoryThroughCore(
      [item],
      [{ id: 'O1', sku: 'JAE-1', item: 'Test', status: 'Packed', deadline: '2026-08-06' }],
      { ...settings, finance: { ...settings.finance!, transactions: [{ id: 'T1', date: '2026-08-05', type: 'sale', category: 'Sale', amount: 30, description: 'Test', sku: 'JAE-1' }] } },
      'JAE-1',
      { ...item, sku: 'JAE-2' },
    )
    expect(result.items[0].sku).toBe('JAE-2')
    expect(result.orders[0].sku).toBe('JAE-2')
    expect(result.settings.finance?.transactions[0].sku).toBe('JAE-2')
  })

  it('blocks duplicate SKUs', () => {
    expect(() => saveInventoryThroughCore(
      [item, { ...item, sku: 'JAE-2' }], [], settings, 'JAE-2', { ...item, sku: 'JAE-1' },
    )).toThrow(/already exists/)
  })

  it('reports broken relationships and system health', () => {
    const relationships = inspectRelationships([item], [{ id: 'O1', sku: 'MISSING', item: 'Missing', status: 'Packed', deadline: '2026-08-06' }], settings)
    expect(relationships.orphanOrderIds).toEqual(['O1'])
    const health = calculateSystemHealth([item], [{ id: 'O1', sku: 'MISSING', item: 'Missing', status: 'Packed', deadline: '2026-08-06' }], settings)
    expect(health.brokenRelationships).toBe(1)
    expect(health.score).toBeLessThan(100)
  })
})
