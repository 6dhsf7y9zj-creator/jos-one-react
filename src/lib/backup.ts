import type { InventoryItem, JosSettings, OrderRecord, StockStatus } from '../types/inventory'

export type JosBackup = {
  version: string
  exportedAt?: string
  items: InventoryItem[]
  orders: OrderRecord[]
  settings: JosSettings
}

const validStatuses: StockStatus[] = ['Prep', 'Photographed', 'Live', 'Sold', 'Dispatched', 'Archived']

function numberValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function textValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function statusValue(value: unknown): StockStatus {
  const status = textValue(value, 'Prep') as StockStatus
  return validStatuses.includes(status) ? status : 'Prep'
}

function gradeValue(value: unknown): InventoryItem['grade'] {
  return value === 'A' || value === 'B' || value === 'C' || value === 'Exit' ? value : 'B'
}

export function migrateBackup(input: unknown): JosBackup {
  if (!input || typeof input !== 'object') throw new Error('This file is not a valid JOS backup.')
  const raw = input as Record<string, unknown>
  if (!Array.isArray(raw.items)) throw new Error('The backup does not contain an inventory list.')

  const items = raw.items.map((entry, index): InventoryItem => {
    if (!entry || typeof entry !== 'object') throw new Error(`Inventory item ${index + 1} is invalid.`)
    const item = entry as Record<string, unknown>
    const sku = textValue(item.sku).trim()
    if (!sku) throw new Error(`Inventory item ${index + 1} has no SKU.`)

    const landedCost = numberValue(item.landedCost, numberValue(item.purchasePrice))
    const originalPurchasePrice = numberValue(item.purchasePrice, landedCost)
    const expectedSalePrice = numberValue(item.expectedSalePrice, numberValue(item.expectedSale))

    return {
      sku,
      brand: textValue(item.brand, 'Unknown brand'),
      category: textValue(item.category, 'Other'),
      description: textValue(item.description, `${textValue(item.brand)} ${textValue(item.category)}`.trim()),
      size: textValue(item.size, 'Unknown'),
      condition: textValue(item.condition, 'Not recorded'),
      status: statusValue(item.status),
      grade: gradeValue(item.grade),
      purchasePrice: landedCost,
      expectedSalePrice,
      storageLocation: textValue(item.storageLocation, textValue(item.storage, 'TBC')),
      department: textValue(item.department),
      originalPurchasePrice,
      landedCost,
      listPrice: numberValue(item.listPrice),
      expectedProfit: numberValue(item.expectedProfit, expectedSalePrice - landedCost),
      roi: numberValue(item.roi),
      daysInStock: numberValue(item.daysInStock),
      action: textValue(item.action),
      listingStage: textValue(item.listingStage),
      platform: textValue(item.platform),
    }
  })

  const duplicateSkus = items.filter((item, index) => items.findIndex(other => other.sku === item.sku) !== index)
  if (duplicateSkus.length) throw new Error(`Duplicate SKU found: ${duplicateSkus[0].sku}`)

  const orders: OrderRecord[] = Array.isArray(raw.orders)
    ? raw.orders.filter(order => order && typeof order === 'object').map(order => {
        const record = order as Record<string, unknown>
        return {
          id: textValue(record.id),
          sku: textValue(record.sku),
          item: textValue(record.item),
          status: textValue(record.status),
          deadline: textValue(record.deadline),
        }
      })
    : []

  const rawSettings = raw.settings && typeof raw.settings === 'object'
    ? raw.settings as Record<string, unknown>
    : {}

  const settings: JosSettings = {
    minimumProfit: numberValue(rawSettings.minimumProfit, 15),
    targetRoi: numberValue(rawSettings.targetRoi, 150),
    storageLocations: Array.isArray(rawSettings.storageLocations)
      ? rawSettings.storageLocations.filter((value): value is string => typeof value === 'string')
      : [],
  }

  return {
    version: textValue(raw.version, 'unknown'),
    items,
    orders,
    settings,
  }
}

export function createBackup(items: InventoryItem[], orders: OrderRecord[], settings: JosSettings): JosBackup {
  return {
    version: '2.4.0',
    exportedAt: new Date().toISOString(),
    items,
    orders,
    settings,
  }
}
