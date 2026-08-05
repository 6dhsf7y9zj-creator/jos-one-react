import type { InventoryItem, OrderRecord, OrderStatus } from '../types/inventory'

export const orderStages: OrderStatus[] = [
  'Paid',
  'Ready to pack',
  'Packed',
  'Dispatched',
  'Delivered',
]

export function normaliseOrder(order: OrderRecord): OrderRecord {
  return {
    ...order,
    status: order.status || 'Paid',
    deadline: order.deadline || '',
    platform: order.platform || 'Vinted',
    salePrice: typeof order.salePrice === 'number' ? order.salePrice : undefined,
    postageIncome: typeof order.postageIncome === 'number' ? order.postageIncome : undefined,
    refundAmount: typeof order.refundAmount === 'number' ? order.refundAmount : undefined,
  }
}

export function nextOrderStatus(status: string): OrderStatus | undefined {
  const index = orderStages.indexOf(status as OrderStatus)
  if (index < 0) return status === 'Sold' ? 'Ready to pack' : undefined
  return orderStages[index + 1]
}

export function advanceOrder(order: OrderRecord, now = new Date()): OrderRecord {
  const next = nextOrderStatus(order.status)
  if (!next) return order
  const iso = now.toISOString()
  return {
    ...order,
    status: next,
    packedAt: next === 'Packed' && !order.packedAt ? iso : order.packedAt,
    dispatchedAt: next === 'Dispatched' && !order.dispatchedAt ? iso : order.dispatchedAt,
    deliveredAt: next === 'Delivered' && !order.deliveredAt ? iso : order.deliveredAt,
  }
}

export function orderInventoryStatus(order: OrderRecord): InventoryItem['status'] | undefined {
  if (order.status === 'Dispatched' || order.status === 'Delivered') return 'Dispatched'
  if (['Paid', 'Ready to pack', 'Packed', 'Return requested', 'Returned', 'Refunded'].includes(order.status)) return 'Sold'
  return undefined
}

export function isActiveOrder(order: OrderRecord): boolean {
  return !['Delivered', 'Refunded', 'Cancelled'].includes(order.status)
}

export function customerKey(order: OrderRecord): string {
  return (order.buyerUsername || order.buyerName || 'Unknown buyer').trim().toLowerCase()
}

export function calculateOrderMetrics(orders: OrderRecord[]) {
  const active = orders.filter(isActiveOrder)
  const completed = orders.filter(order => order.status === 'Delivered')
  const revenue = orders.reduce((sum, order) => sum + (order.salePrice || 0), 0)
  const refunds = orders.reduce((sum, order) => sum + (order.refundAmount || 0), 0)
  const customerCounts = new Map<string, number>()
  for (const order of orders) {
    const key = customerKey(order)
    customerCounts.set(key, (customerCounts.get(key) || 0) + 1)
  }
  const repeatCustomers = [...customerCounts.values()].filter(count => count > 1).length
  return {
    active: active.length,
    dispatchWaiting: orders.filter(order => ['Paid', 'Ready to pack', 'Packed'].includes(order.status)).length,
    completed: completed.length,
    revenue,
    netRevenue: revenue - refunds,
    averageOrderValue: orders.length ? revenue / orders.length : 0,
    repeatCustomers,
    returns: orders.filter(order => ['Return requested', 'Returned', 'Refunded'].includes(order.status)).length,
  }
}

export function customerSummaries(orders: OrderRecord[]) {
  const map = new Map<string, { name: string; username?: string; orders: number; revenue: number; latest?: string; platforms: Set<string> }>()
  for (const order of orders) {
    const key = customerKey(order)
    const existing = map.get(key) || {
      name: order.buyerName || order.buyerUsername || 'Unknown buyer',
      username: order.buyerUsername,
      orders: 0,
      revenue: 0,
      latest: undefined,
      platforms: new Set<string>(),
    }
    existing.orders += 1
    existing.revenue += order.salePrice || 0
    if (order.platform) existing.platforms.add(order.platform)
    const date = order.placedAt || order.dispatchedAt || order.deliveredAt
    if (date && (!existing.latest || date > existing.latest)) existing.latest = date
    map.set(key, existing)
  }
  return [...map.values()].map(value => ({ ...value, platforms: [...value.platforms] }))
    .sort((a,b) => b.orders - a.orders || b.revenue - a.revenue)
}
