import type { InventoryItem, JosSettings, OrderRecord } from '../types/inventory.ts'

export const DATA_HUB_VERSION = '1.0.0'

export type DataHubValidation = 'valid' | 'warning' | 'invalid'

export type DataHubMetric = {
  key: string
  owner: 'Inventory' | 'Finance' | 'Orders' | 'Core'
  value: number
  unit: 'GBP' | 'count' | 'percent'
  refreshedAt: string
  version: string
  validation: DataHubValidation
}

export type InventoryFinanceHandover = {
  sku: string
  stockStatus: InventoryItem['status']
  landedCost: number
  expectedSalePrice: number
  actualSalePrice?: number
  financeTransactionIds: string[]
  recordedSales: number
  recordedExpenses: number
  validation: DataHubValidation
  issues: string[]
}

export type DataHubSnapshot = {
  version: string
  refreshedAt: string
  validation: DataHubValidation
  metrics: Record<string, DataHubMetric>
  inventoryFinance: InventoryFinanceHandover[]
  issues: string[]
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export function buildDataHubSnapshot(
  items: InventoryItem[],
  orders: OrderRecord[],
  settings: JosSettings,
  refreshedAt = new Date().toISOString(),
): DataHubSnapshot {
  const transactions = settings.finance?.transactions ?? []
  const skuSet = new Set(items.map(item => item.sku))
  const duplicateSkus = items.filter((item, index) => items.findIndex(other => other.sku === item.sku) !== index).map(item => item.sku)
  const orphanTransactions = transactions.filter(transaction => transaction.sku && !skuSet.has(transaction.sku))
  const orphanOrders = orders.filter(order => order.sku && !skuSet.has(order.sku))

  const inventoryFinance = items.map(item => {
    const linked = transactions.filter(transaction => transaction.sku === item.sku)
    const recordedSales = linked.filter(transaction => transaction.type === 'sale').reduce((sum, transaction) => sum + transaction.amount, 0)
    const recordedExpenses = linked.filter(transaction => transaction.type === 'expense').reduce((sum, transaction) => sum + transaction.amount, 0)
    const issues: string[] = []
    if (item.status === 'Sold' && recordedSales <= 0 && !item.actualSalePrice) issues.push('Sold item has no linked sale evidence')
    if (!item.storageLocation || item.storageLocation.trim().toUpperCase() === 'TBC') issues.push('Storage location missing')
    return {
      sku: item.sku,
      stockStatus: item.status,
      landedCost: money(item.landedCost ?? item.purchasePrice),
      expectedSalePrice: money(item.expectedSalePrice),
      actualSalePrice: item.actualSalePrice,
      financeTransactionIds: linked.map(transaction => transaction.id),
      recordedSales: money(recordedSales),
      recordedExpenses: money(recordedExpenses),
      validation: issues.length ? 'warning' as const : 'valid' as const,
      issues,
    }
  })

  const active = items.filter(item => !['Sold', 'Dispatched', 'Archived'].includes(item.status))
  const inventoryCost = active.reduce((sum, item) => sum + (item.landedCost ?? item.purchasePrice), 0)
  const expectedRevenue = active.reduce((sum, item) => sum + item.expectedSalePrice, 0)
  const salesIncome = transactions.filter(transaction => transaction.type === 'sale').reduce((sum, transaction) => sum + transaction.amount, 0)
  const expenses = transactions.filter(transaction => transaction.type === 'expense').reduce((sum, transaction) => sum + transaction.amount, 0)
  const openingCash = settings.finance?.openingCash ?? 0
  const cashBalance = openingCash + transactions.reduce((sum, transaction) => {
    if (['sale', 'owner-funding', 'tax-reserve-out'].includes(transaction.type)) return sum + transaction.amount
    return sum - transaction.amount
  }, 0)
  const reserve = settings.finance?.emergencyReserve ?? 0
  const safeToReinvest = Math.max(0, cashBalance - reserve)
  const linkedTransactions = transactions.filter(transaction => transaction.sku && skuSet.has(transaction.sku)).length
  const linkRate = transactions.length ? linkedTransactions / transactions.length * 100 : 100

  const issues = [
    ...(duplicateSkus.length ? [`${duplicateSkus.length} duplicate SKU record(s)`] : []),
    ...(orphanTransactions.length ? [`${orphanTransactions.length} finance transaction(s) reference missing SKUs`] : []),
    ...(orphanOrders.length ? [`${orphanOrders.length} order(s) reference missing SKUs`] : []),
  ]
  const validation: DataHubValidation = duplicateSkus.length || orphanTransactions.length || orphanOrders.length ? 'invalid' : inventoryFinance.some(row => row.validation === 'warning') ? 'warning' : 'valid'

  const metric = (key: string, owner: DataHubMetric['owner'], value: number, unit: DataHubMetric['unit']): DataHubMetric => ({ key, owner, value: money(value), unit, refreshedAt, version: DATA_HUB_VERSION, validation })
  const metrics = [
    metric('inventory.active_count', 'Inventory', active.length, 'count'),
    metric('inventory.active_stock_cost', 'Inventory', inventoryCost, 'GBP'),
    metric('inventory.expected_revenue', 'Inventory', expectedRevenue, 'GBP'),
    metric('finance.recorded_sales', 'Finance', salesIncome, 'GBP'),
    metric('finance.recorded_expenses', 'Finance', expenses, 'GBP'),
    metric('finance.cash_balance', 'Finance', cashBalance, 'GBP'),
    metric('finance.safe_to_reinvest', 'Finance', safeToReinvest, 'GBP'),
    metric('finance.sku_link_rate', 'Finance', linkRate, 'percent'),
    metric('orders.open_count', 'Orders', orders.filter(order => !['Delivered', 'Returned', 'Refunded', 'Cancelled'].includes(order.status)).length, 'count'),
  ]

  return { version: DATA_HUB_VERSION, refreshedAt, validation, metrics: Object.fromEntries(metrics.map(item => [item.key, item])), inventoryFinance, issues }
}
