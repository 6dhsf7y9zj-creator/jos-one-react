import type { InventoryItem, JosSettings, OrderRecord } from '../types/inventory.ts'
import { publishBusinessEvent } from './EventBus.ts'
import { blockingIssues, validateInventoryItem } from './ValidationEngine.ts'

export type InventorySaveResult = {
  items: InventoryItem[]
  orders: OrderRecord[]
  settings: JosSettings
  warnings: string[]
}

export function saveInventoryThroughCore(
  items: InventoryItem[],
  orders: OrderRecord[],
  settings: JosSettings,
  originalSku: string | undefined,
  updated: InventoryItem,
): InventorySaveResult {
  const normalised = { ...updated, sku: updated.sku.trim(), brand: updated.brand.trim(), category: updated.category.trim() }
  const issues = validateInventoryItem(normalised, items, settings, originalSku)
  const errors = blockingIssues(issues)
  if (errors.length) throw new Error(errors.map(issue => issue.message).join('\n'))

  const exists = originalSku ? items.some(item => item.sku === originalSku) : false
  const nextItems = exists
    ? items.map(item => item.sku === originalSku ? normalised : item)
    : [...items, normalised]
  let nextOrders = orders
  let nextSettings = settings
  if (originalSku && originalSku !== normalised.sku) {
    nextOrders = orders.map(order => order.sku === originalSku ? { ...order, sku: normalised.sku } : order)
    nextSettings = {
      ...settings,
      finance: settings.finance ? {
        ...settings.finance,
        transactions: settings.finance.transactions.map(transaction =>
          transaction.sku === originalSku ? { ...transaction, sku: normalised.sku } : transaction,
        ),
      } : settings.finance,
    }
  }
  publishBusinessEvent({
    type: exists ? 'inventory.updated' : 'inventory.created',
    entityId: normalised.sku,
    summary: `${exists ? 'Updated' : 'Created'} ${normalised.sku} · ${normalised.brand} ${normalised.category}`,
    metadata: { originalSku, newSku: normalised.sku },
  })
  return {
    items: nextItems,
    orders: nextOrders,
    settings: nextSettings,
    warnings: issues.filter(issue => issue.severity === 'warning').map(issue => issue.message),
  }
}

export function deleteInventoryThroughCore(items: InventoryItem[], sku: string): InventoryItem[] {
  publishBusinessEvent({ type: 'inventory.deleted', entityId: sku, summary: `Deleted inventory item ${sku}` })
  return items.filter(item => item.sku !== sku)
}
