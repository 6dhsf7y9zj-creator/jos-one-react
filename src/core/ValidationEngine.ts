import type { InventoryItem, JosSettings } from '../types/inventory.ts'

export type ValidationIssue = {
  code: string
  message: string
  field?: keyof InventoryItem
  severity: 'error' | 'warning'
}

export function validateInventoryItem(
  item: InventoryItem,
  allItems: InventoryItem[],
  settings: JosSettings,
  originalSku?: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const sku = item.sku.trim()
  if (!sku) issues.push({ code: 'SKU_REQUIRED', message: 'SKU is required.', field: 'sku', severity: 'error' })
  if (allItems.some(existing => existing.sku === sku && existing.sku !== originalSku)) {
    issues.push({ code: 'SKU_DUPLICATE', message: `SKU ${sku} already exists.`, field: 'sku', severity: 'error' })
  }
  if (!item.brand.trim()) issues.push({ code: 'BRAND_REQUIRED', message: 'Brand is required.', field: 'brand', severity: 'error' })
  if (!item.category.trim()) issues.push({ code: 'CATEGORY_REQUIRED', message: 'Category is required.', field: 'category', severity: 'error' })
  if (item.purchasePrice < 0) issues.push({ code: 'PURCHASE_PRICE_NEGATIVE', message: 'Purchase price cannot be negative.', field: 'purchasePrice', severity: 'error' })
  if (item.expectedSalePrice < 0) issues.push({ code: 'SALE_PRICE_NEGATIVE', message: 'Expected sale price cannot be negative.', field: 'expectedSalePrice', severity: 'error' })
  if (!item.storageLocation || item.storageLocation.trim().toUpperCase() === 'TBC') {
    issues.push({ code: 'STORAGE_MISSING', message: 'Storage location still needs assigning.', field: 'storageLocation', severity: 'warning' })
  } else if (settings.storageLocations.length && !settings.storageLocations.includes(item.storageLocation)) {
    issues.push({ code: 'STORAGE_UNKNOWN', message: 'Storage location is not in Settings.', field: 'storageLocation', severity: 'warning' })
  }
  return issues
}

export function blockingIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter(issue => issue.severity === 'error')
}
