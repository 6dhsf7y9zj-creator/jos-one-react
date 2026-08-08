import { describe, expect, it } from 'vitest'
import type { InventoryItem, OrderRecord } from '../types/inventory.ts'
import { calculateOperations } from './operations.ts'

const item = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  sku: 'JAE-001', brand: 'Nike', category: 'Hoodie', description: 'Nike hoodie',
  size: 'M', condition: 'Very Good', status: 'Prep', grade: 'A', purchasePrice: 5,
  expectedSalePrice: 20, storageLocation: 'A1', ...overrides,
})

describe('Operations Command Centre', () => {
  it('places waiting orders ahead of pipeline growth work', () => {
    const orders: OrderRecord[] = [{ id: 'ORD-1', sku: 'JAE-001', item: 'Nike hoodie', status: 'Ready', deadline: 'Today' }]
    const result = calculateOperations([item({ pipelineStage: 'Ready to Upload' })], orders)
    expect(result.tasks[0].destination).toBe('orders')
  })

  it('ranks high profit ready-to-upload stock above preparation work', () => {
    const result = calculateOperations([
      item({ sku: 'JAE-001', pipelineStage: 'Preparation', expectedSalePrice: 50 }),
      item({ sku: 'JAE-002', pipelineStage: 'Ready to Upload', expectedSalePrice: 20 }),
    ], [])
    expect(result.tasks[0].id).toBe('upload-JAE-002')
  })

  it('does not count dispatched orders as waiting', () => {
    const orders: OrderRecord[] = [{ id: 'ORD-1', sku: 'JAE-001', item: 'Nike hoodie', status: 'Dispatched', deadline: 'Today' }]
    const result = calculateOperations([], orders)
    expect(result.ordersWaiting).toBe(0)
  })
})
