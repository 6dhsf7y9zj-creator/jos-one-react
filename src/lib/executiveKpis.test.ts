import { describe, expect, it } from 'vitest'
import type { FinanceState, InventoryItem, OrderRecord } from '../types/inventory'
import { calculateExecutiveKpis } from './executiveKpis'

const stock = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  sku: 'JAE-001',
  brand: 'Nike',
  category: 'Hoodie',
  description: 'Nike hoodie',
  size: 'M',
  condition: 'Very Good',
  status: 'Live',
  grade: 'B',
  purchasePrice: 5,
  expectedSalePrice: 25,
  storageLocation: 'A1',
  dateSourced: '2026-07-01',
  dateListed: '2026-07-10',
  ...overrides,
})

describe('Executive KPI Engine', () => {
  it('keeps forecast and realised profit separate', () => {
    const finance: FinanceState = {
      openingCash: 100,
      emergencyReserve: 20,
      plannedSourcingBudget: 50,
      taxPlanningRate: 20,
      transactions: [{
        id: 'FIN-1',
        date: '2026-08-01',
        type: 'sale',
        category: 'Vinted sale',
        amount: 25,
        description: 'Sale',
        sku: 'JAE-002',
      }],
    }

    const result = calculateExecutiveKpis([
      stock(),
      stock({
        sku: 'JAE-002',
        status: 'Dispatched',
        actualSalePrice: 25,
        dateSold: '2026-08-01',
      }),
    ], [], finance, new Date('2026-08-02T12:00:00'))

    expect(result.forecastGrossProfit).toBe(20)
    expect(result.realisedRevenue).toBe(25)
    expect(result.realisedOperatingProfit).toBe(20)
  })

  it('does not invent average days to sell without dates', () => {
    const result = calculateExecutiveKpis([
      stock({
        status: 'Dispatched',
        actualSalePrice: 25,
        dateSourced: undefined,
        dateListed: undefined,
        dateSold: undefined,
      }),
    ], [])
    expect(result.averageDaysToSell).toBeUndefined()
  })

  it('counts active customer commitments as pending dispatches', () => {
    const orders: OrderRecord[] = [{
      id: 'ORDER-1',
      sku: 'JAE-001',
      item: 'Nike hoodie',
      status: 'Packed',
      deadline: '2026-08-03',
    }]
    const result = calculateExecutiveKpis([stock()], orders)
    expect(result.pendingDispatches).toBe(1)
  })

  it('limits confidence when realised evidence is scarce', () => {
    const result = calculateExecutiveKpis([stock()], [])
    expect(result.confidence).toBe('limited')
  })
})
