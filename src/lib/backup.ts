import type { FinanceState, FinanceTransaction, FinanceTransactionType, InventoryItem, JosSettings, ListingChecklist, ListingPipelineStage, OrderRecord, PhotoChecklist, StockStatus } from '../types/inventory'
import { normaliseAutomationSettings } from './automationCentre'

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



const validPipelineStages: ListingPipelineStage[] = [
  'Preparation',
  'Photography',
  'Photo Review',
  'Listing Copy',
  'Ready to Upload',
  'Live',
]

function pipelineStageValue(value: unknown): ListingPipelineStage | undefined {
  const stage = textValue(value) as ListingPipelineStage
  return validPipelineStages.includes(stage) ? stage : undefined
}

function booleanRecord<T extends object>(
  value: unknown,
  fallback: T,
): T {
  if (!value || typeof value !== 'object') return fallback
  const raw = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(fallback).map(key => [key, raw[key] === true]),
  ) as T
}

const validFinanceTypes: FinanceTransactionType[] = [
  'sale',
  'expense',
  'owner-funding',
  'owner-withdrawal',
  'tax-reserve-in',
  'tax-reserve-out',
]

function financeTypeValue(value: unknown): FinanceTransactionType {
  const type = textValue(value) as FinanceTransactionType
  return validFinanceTypes.includes(type) ? type : 'expense'
}

function financeStateValue(value: unknown): FinanceState | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const transactions: FinanceTransaction[] = Array.isArray(raw.transactions)
    ? raw.transactions
        .filter(entry => entry && typeof entry === 'object')
        .map((entry, index) => {
          const record = entry as Record<string, unknown>
          return {
            id: textValue(record.id, `MIGRATED-FIN-${index + 1}`),
            date: textValue(record.date, new Date().toISOString().slice(0, 10)),
            type: financeTypeValue(record.type),
            category: textValue(record.category, 'Other'),
            amount: Math.max(0, numberValue(record.amount)),
            description: textValue(record.description, 'Migrated finance entry'),
            sku: textValue(record.sku) || undefined,
            notes: textValue(record.notes) || undefined,
          }
        })
    : []

  return {
    openingCash: numberValue(raw.openingCash),
    emergencyReserve: numberValue(raw.emergencyReserve),
    plannedSourcingBudget: numberValue(raw.plannedSourcingBudget),
    taxPlanningRate: numberValue(raw.taxPlanningRate, 20),
    transactions,
  }
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
      colour: textValue(item.colour) || undefined,
      notes: textValue(item.notes) || undefined,
      actualSalePrice: item.actualSalePrice === undefined ? undefined : numberValue(item.actualSalePrice),
      dateSourced: textValue(item.dateSourced) || undefined,
      dateListed: textValue(item.dateListed) || undefined,
      dateSold: textValue(item.dateSold) || undefined,
      pipelineStage: pipelineStageValue(item.pipelineStage),
      photoChecklist: booleanRecord<PhotoChecklist>(item.photoChecklist, {
        front: false,
        back: false,
        brandLabel: false,
        sizeLabel: false,
        careLabel: false,
        measurements: false,
        defects: false,
      }),
      listingChecklist: booleanRecord<ListingChecklist>(item.listingChecklist, {
        title: false,
        description: false,
        measurements: false,
        condition: false,
        price: false,
        platform: false,
      }),
      photographyStartedAt: textValue(item.photographyStartedAt) || undefined,
      photographyCompletedAt: textValue(item.photographyCompletedAt) || undefined,
      listingReadyAt: textValue(item.listingReadyAt) || undefined,
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
          status: textValue(record.status, 'Paid'),
          deadline: textValue(record.deadline),
          buyerName: textValue(record.buyerName) || undefined,
          buyerUsername: textValue(record.buyerUsername) || undefined,
          platform: textValue(record.platform) || undefined,
          salePrice: record.salePrice === undefined ? undefined : numberValue(record.salePrice),
          postageIncome: record.postageIncome === undefined ? undefined : numberValue(record.postageIncome),
          trackingNumber: textValue(record.trackingNumber) || undefined,
          carrier: textValue(record.carrier) || undefined,
          placedAt: textValue(record.placedAt) || undefined,
          packedAt: textValue(record.packedAt) || undefined,
          dispatchedAt: textValue(record.dispatchedAt) || undefined,
          deliveredAt: textValue(record.deliveredAt) || undefined,
          returnReason: textValue(record.returnReason) || undefined,
          refundAmount: record.refundAmount === undefined ? undefined : numberValue(record.refundAmount),
          notes: textValue(record.notes) || undefined,
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
    monthlyProfitTarget: numberValue(rawSettings.monthlyProfitTarget, 5000),
    automation: normaliseAutomationSettings(rawSettings.automation),
    finance: financeStateValue(rawSettings.finance),
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
    version: '3.3.0',
    exportedAt: new Date().toISOString(),
    items,
    orders,
    settings,
  }
}
