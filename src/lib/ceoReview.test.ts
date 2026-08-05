import { describe, expect, it } from 'vitest'
import type { InventoryItem, JosSettings, OrderRecord } from '../types/inventory.ts'
import { buildCeoReview } from './ceoReview.ts'

const settings: JosSettings = {
  minimumProfit: 15,
  targetRoi: 150,
  storageLocations: ['A1'],
  finance: {
    openingCash: 100,
    emergencyReserve: 20,
    plannedSourcingBudget: 50,
    taxPlanningRate: 20,
    transactions: [],
  },
}

const item: InventoryItem = {
  sku: 'JAE-001',
  brand: 'Nike',
  category: 'Hoodie',
  description: 'Nike hoodie',
  size: 'M',
  condition: 'Very Good',
  status: 'Prep',
  grade: 'A',
  purchasePrice: 5,
  expectedSalePrice: 20,
  storageLocation: 'A1',
}

describe('CEO Review Centre', () => {
  it('places dispatch first when an order is waiting', () => {
    const orders: OrderRecord[] = [{
      id: 'ORD-1',
      sku: 'JAE-001',
      item: 'Nike hoodie',
      status: 'Ready to pack',
      deadline: 'Today',
    }]
    const review = buildCeoReview([item], orders, settings, new Date('2026-08-02T12:00:00'))
    expect(review.priorities[0].id).toBe('dispatch')
  })

  it('uses finance records for sourcing budget', () => {
    const review = buildCeoReview([item], [], settings, new Date('2026-08-02T12:00:00'))
    expect(review.availableSourcingBudget).toBe(50)
  })

  it('labels forecasts as data truth rather than realised results', () => {
    const review = buildCeoReview([item], [], settings)
    expect(review.dataTruth.some(value => value.includes('forecasts'))).toBe(true)
  })
})
