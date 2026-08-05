import { describe, expect, it } from 'vitest'
import type { InventoryItem, OrderRecord } from '../types/inventory'
import { calculateCeoDashboard } from './dashboard'

const item = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  sku: 'JAE-0001',
  brand: 'Nike',
  category: 'Hoodie',
  description: 'Nike hoodie',
  size: 'M',
  condition: 'Very Good',
  status: 'Prep',
  grade: 'B',
  purchasePrice: 5,
  expectedSalePrice: 20,
  storageLocation: 'Box A1',
  ...overrides,
})

describe('CEO dashboard', () => {
  it('calculates financial totals from active stock', () => {
    const result = calculateCeoDashboard(
      [item(), item({ sku: 'JAE-0002', purchasePrice: 10, expectedSalePrice: 30 })],
      [],
      new Date('2027-01-01'),
      new Date('2026-08-02'),
    )

    expect(result.inventoryCost).toBe(15)
    expect(result.expectedSales).toBe(50)
    expect(result.expectedProfit).toBe(35)
  })

  it('prioritises dispatch when orders are waiting', () => {
    const orders: OrderRecord[] = [{
      id: 'ORD-1',
      sku: 'JAE-0001',
      item: 'Nike hoodie',
      status: 'Ready to pack',
      deadline: 'Today',
    }]

    const result = calculateCeoDashboard([item()], orders)
    expect(result.missions[0].id).toBe('dispatch')
  })

  it('does not describe unknown cash as available cash', () => {
    const result = calculateCeoDashboard([item()], [])
    expect(result.inventoryCost).toBe(5)
    expect(result).not.toHaveProperty('cashAvailable')
  })
})
