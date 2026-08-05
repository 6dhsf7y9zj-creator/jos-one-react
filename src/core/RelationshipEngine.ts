import type { InventoryItem, JosSettings, OrderRecord } from '../types/inventory.ts'

export type RelationshipReport = {
  duplicateSkus: string[]
  orphanOrderIds: string[]
  orphanFinanceTransactionIds: string[]
  soldItemsWithoutOrderOrSale: string[]
  linkedOrders: number
  linkedFinanceTransactions: number
}

export function inspectRelationships(
  items: InventoryItem[],
  orders: OrderRecord[],
  settings: JosSettings,
): RelationshipReport {
  const counts = new Map<string, number>()
  items.forEach(item => counts.set(item.sku, (counts.get(item.sku) ?? 0) + 1))
  const duplicateSkus = [...counts.entries()].filter(([, count]) => count > 1).map(([sku]) => sku)
  const skus = new Set(items.map(item => item.sku))
  const finance = settings.finance?.transactions ?? []
  const orphanOrderIds = orders.filter(order => order.sku && !skus.has(order.sku)).map(order => order.id)
  const orphanFinanceTransactionIds = finance
    .filter(transaction => transaction.sku && !skus.has(transaction.sku))
    .map(transaction => transaction.id)
  const linkedOrderSkus = new Set(orders.map(order => order.sku).filter(Boolean))
  const linkedFinanceSkus = new Set(finance.map(transaction => transaction.sku).filter(Boolean))
  const soldItemsWithoutOrderOrSale = items
    .filter(item => item.status === 'Sold' && !linkedOrderSkus.has(item.sku) && !linkedFinanceSkus.has(item.sku))
    .map(item => item.sku)
  return {
    duplicateSkus,
    orphanOrderIds,
    orphanFinanceTransactionIds,
    soldItemsWithoutOrderOrSale,
    linkedOrders: orders.filter(order => order.sku && skus.has(order.sku)).length,
    linkedFinanceTransactions: finance.filter(transaction => transaction.sku && skus.has(transaction.sku)).length,
  }
}
