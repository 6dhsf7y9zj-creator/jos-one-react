import { describe, expect, it } from 'vitest'
import { advanceOrder, calculateOrderMetrics } from './orders'

const order = { id: 'O1', sku: 'JAE-1', item: 'Nike hoodie', status: 'Ready to pack', deadline: '' }

describe('Customer and Orders logic', () => {
  it('advances an order and records packing time', () => {
    const result = advanceOrder(order, new Date('2026-08-02T12:00:00Z'))
    expect(result.status).toBe('Packed')
    expect(result.packedAt).toContain('2026-08-02')
  })
  it('separates revenue from refunds', () => {
    const metrics = calculateOrderMetrics([{ ...order, salePrice: 20, refundAmount: 5 }])
    expect(metrics.netRevenue).toBe(15)
  })
})
