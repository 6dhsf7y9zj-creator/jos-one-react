import { describe, expect, it } from 'vitest'
import type { FinanceState, InventoryItem } from '../types/inventory.ts'
import { calculateFinanceSummary } from './finance.ts'

const stock: InventoryItem = {
  sku: 'JAE-001',
  brand: 'Nike',
  category: 'Hoodie',
  description: 'Nike hoodie',
  size: 'M',
  condition: 'Very Good',
  status: 'Sold',
  grade: 'A',
  purchasePrice: 5,
  expectedSalePrice: 20,
  storageLocation: 'Box A1',
}

describe('Finance Command Centre', () => {
  it('calculates cash and realised profit from recorded transactions', () => {
    const finance: FinanceState = {
      openingCash: 100,
      emergencyReserve: 20,
      plannedSourcingBudget: 50,
      taxPlanningRate: 20,
      transactions: [
        { id: '1', date: '2026-08-02', type: 'sale', category: 'Vinted sale', amount: 25, description: 'Sold hoodie', sku: 'JAE-001' },
        { id: '2', date: '2026-08-02', type: 'expense', category: 'Packaging', amount: 3, description: 'Mailers' },
        { id: '3', date: '2026-08-02', type: 'tax-reserve-in', category: 'Tax reserve', amount: 4, description: 'Reserve transfer' },
      ],
    }

    const summary = calculateFinanceSummary(finance, [stock], new Date('2026-08-02'))
    expect(summary.operatingProfit).toBe(17)
    expect(summary.cashBalance).toBe(118)
    expect(summary.taxReserveBalance).toBe(4)
    expect(summary.availableSourcingBudget).toBe(50)
  })

  it('does not invent cost of goods when a sale is not linked to an SKU', () => {
    const finance: FinanceState = {
      openingCash: 0,
      emergencyReserve: 0,
      plannedSourcingBudget: 0,
      taxPlanningRate: 20,
      transactions: [
        { id: '1', date: '2026-08-02', type: 'sale', category: 'Sale', amount: 20, description: 'Unlinked sale' },
      ],
    }

    const summary = calculateFinanceSummary(finance, [stock], new Date('2026-08-02'))
    expect(summary.costOfGoodsSold).toBe(0)
    expect(summary.operatingProfit).toBe(20)
  })
})
