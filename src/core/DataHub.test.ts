import { describe, expect, it } from 'vitest'
import { buildDataHubSnapshot } from './DataHub.ts'
import type { InventoryItem, JosSettings } from '../types/inventory.ts'

const item: InventoryItem = { sku: 'JAE-1', brand: 'Nike', category: 'Hoodie', description: 'Test', size: 'M', condition: 'Good', status: 'Live', grade: 'A', purchasePrice: 10, landedCost: 12, expectedSalePrice: 30, storageLocation: 'A1' }
const settings: JosSettings = { minimumProfit: 15, targetRoi: 150, storageLocations: ['A1'], finance: { openingCash: 100, emergencyReserve: 25, plannedSourcingBudget: 0, taxPlanningRate: 20, transactions: [{ id: 'S1', date: '2026-08-05', type: 'sale', category: 'Sales', amount: 30, description: 'Sale', sku: 'JAE-1' }] } }

describe('JOS Data Hub v1.0', () => {
  it('publishes named Inventory and Finance metrics', () => {
    const hub = buildDataHubSnapshot([item], [], settings, '2026-08-05T18:00:00.000Z')
    expect(hub.metrics['inventory.active_stock_cost'].value).toBe(12)
    expect(hub.metrics['finance.recorded_sales'].value).toBe(30)
    expect(hub.metrics['finance.safe_to_reinvest'].value).toBe(105)
  })
  it('hands inventory to finance by SKU rather than position', () => {
    const hub = buildDataHubSnapshot([item], [], settings)
    expect(hub.inventoryFinance[0].financeTransactionIds).toEqual(['S1'])
    expect(hub.inventoryFinance[0].recordedSales).toBe(30)
  })
  it('invalidates orphan finance relationships', () => {
    const broken = { ...settings, finance: { ...settings.finance!, transactions: [{ ...settings.finance!.transactions[0], sku: 'MISSING' }] } }
    const hub = buildDataHubSnapshot([item], [], broken)
    expect(hub.validation).toBe('invalid')
    expect(hub.issues.join(' ')).toContain('finance transaction')
  })
})
