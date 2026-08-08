import type { InventoryItem, JosSettings, OrderRecord } from '../types/inventory.ts'
import { inspectRelationships } from './RelationshipEngine.ts'

export type SystemHealthReport = {
  score: number
  label: 'Excellent' | 'Good' | 'Needs attention' | 'At risk'
  errors: number
  warnings: number
  completeness: number
  duplicateSkus: number
  brokenRelationships: number
  missingStorage: number
  missingPrices: number
  checks: Array<{ label: string; status: 'pass' | 'warning' | 'fail'; detail: string }>
}

export function calculateSystemHealth(
  items: InventoryItem[],
  orders: OrderRecord[],
  settings: JosSettings,
): SystemHealthReport {
  const relationships = inspectRelationships(items, orders, settings)
  const missingStorage = items.filter(item => !item.storageLocation || item.storageLocation.trim().toUpperCase() === 'TBC').length
  const missingPrices = items.filter(item => item.purchasePrice < 0 || item.expectedSalePrice <= 0).length
  const incomplete = items.filter(item => !item.sku.trim() || !item.brand.trim() || !item.category.trim()).length
  const completeness = items.length ? Math.round(((items.length - incomplete) / items.length) * 100) : 100
  const brokenRelationships = relationships.orphanOrderIds.length + relationships.orphanFinanceTransactionIds.length
  const errors = relationships.duplicateSkus.length + brokenRelationships + missingPrices
  const warnings = missingStorage + relationships.soldItemsWithoutOrderOrSale.length
  const score = Math.max(0, Math.min(100, Math.round(
    completeness - errors * 12 - warnings * 2,
  )))
  return {
    score,
    label: score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 50 ? 'Needs attention' : 'At risk',
    errors,
    warnings,
    completeness,
    duplicateSkus: relationships.duplicateSkus.length,
    brokenRelationships,
    missingStorage,
    missingPrices,
    checks: [
      { label: 'Inventory records', status: relationships.duplicateSkus.length || missingPrices ? 'fail' : 'pass', detail: `${items.length} records · ${relationships.duplicateSkus.length} duplicate SKUs` },
      { label: 'Orders', status: relationships.orphanOrderIds.length ? 'fail' : 'pass', detail: `${relationships.orphanOrderIds.length} orphaned orders` },
      { label: 'Finance links', status: relationships.orphanFinanceTransactionIds.length ? 'fail' : 'pass', detail: `${relationships.orphanFinanceTransactionIds.length} orphaned transactions` },
      { label: 'Storage', status: missingStorage ? 'warning' : 'pass', detail: `${missingStorage} items need storage` },
      { label: 'Data completeness', status: completeness >= 95 ? 'pass' : 'warning', detail: `${completeness}% complete` },
    ],
  }
}
