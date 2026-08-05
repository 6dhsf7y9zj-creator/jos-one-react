import type { InventoryItem, JosSettings, OrderRecord } from '../types/inventory.ts'

export type JOSCoreSnapshot = {
  items: InventoryItem[]
  orders: OrderRecord[]
  settings: JosSettings
}

export function selectItem(snapshot: JOSCoreSnapshot, sku: string): InventoryItem | undefined {
  return snapshot.items.find(item => item.sku === sku)
}

export function selectOrdersForSku(snapshot: JOSCoreSnapshot, sku: string): OrderRecord[] {
  return snapshot.orders.filter(order => order.sku === sku)
}

export function selectFinanceForSku(snapshot: JOSCoreSnapshot, sku: string) {
  return (snapshot.settings.finance?.transactions ?? []).filter(transaction => transaction.sku === sku)
}
