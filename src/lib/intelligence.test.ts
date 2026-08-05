import { describe, expect, it } from 'vitest'
import type { FinanceState, InventoryItem } from '../types/inventory'
import { calculateBusinessIntelligence } from './intelligence'

const item = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  sku: 'JAE-001', brand: 'Nike', category: 'Hoodie', description: 'Nike hoodie', size: 'M',
  condition: 'Very Good', status: 'Live', grade: 'A', purchasePrice: 5,
  expectedSalePrice: 20, storageLocation: 'Box A1', dateListed: '2026-06-01', ...overrides,
})

describe('Business Intelligence', () => {
  it('separates realised brand evidence from active-stock forecasts', () => {
    const finance: FinanceState = { openingCash: 0, emergencyReserve: 0, plannedSourcingBudget: 0, taxPlanningRate: 20,
      transactions: [{ id: '1', date: '2026-07-01', type: 'sale', category: 'Vinted sale', amount: 25, description: 'Sold item', sku: 'JAE-001' }] }
    const result = calculateBusinessIntelligence([item({ status: 'Sold' })], finance, new Date('2026-08-02'))
    expect(result.brands[0].realisedProfit).toBe(20)
    expect(result.brands[0].realisedSales).toBe(1)
  })

  it('flags ageing stock using recorded dates', () => {
    const result = calculateBusinessIntelligence([item({ dateListed: '2026-04-01' })], undefined, new Date('2026-08-02'))
    expect(result.ageing.days90plus).toBe(1)
  })

  it('does not claim proven brand performance without linked sales', () => {
    const result = calculateBusinessIntelligence([item()], undefined, new Date('2026-08-02'))
    expect(result.insights.some(insight => insight.id === 'forecast-warning')).toBe(true)
  })
})
