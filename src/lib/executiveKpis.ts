import type {
  FinanceState,
  InventoryItem,
  OrderRecord,
} from '../types/inventory.ts'
import { calculateFinanceSummary } from './finance.ts'
import { calculateInventoryIntelligence } from './inventoryIntelligence.ts'

export type ExecutiveConfidence = 'limited' | 'developing' | 'established'

export type ExecutiveKpis = {
  inventoryCost: number
  forecastRevenue: number
  forecastGrossProfit: number
  realisedRevenue: number
  realisedOperatingProfit: number
  cashBalance: number
  cashAvailableToReinvest: number
  taxReserveBalance: number
  activeItems: number
  activeListings: number
  pendingDispatches: number
  completedSales: number
  sellThroughRate: number
  averageForecastRoi: number
  averageDaysToSell?: number
  inventoryHealth: number
  inventoryHealthLabel: string
  dataQuality: number
  confidence: ExecutiveConfidence
  confidenceReason: string
}

function dateValue(value?: string): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function saleDays(item: InventoryItem): number | undefined {
  const sold = dateValue(item.dateSold)
  const started = dateValue(item.dateListed ?? item.dateSourced)
  if (!sold || !started) return undefined
  return Math.max(0, Math.round((sold.getTime() - started.getTime()) / 86_400_000))
}

function completedOrder(order: OrderRecord): boolean {
  return /delivered|completed|archived/i.test(order.status)
}

function waitingOrder(order: OrderRecord): boolean {
  return !/delivered|completed|archived|cancelled|refunded|returned/i.test(order.status)
}

export function calculateExecutiveKpis(
  items: InventoryItem[],
  orders: OrderRecord[],
  finance?: FinanceState,
  now = new Date(),
): ExecutiveKpis {
  const financeSummary = calculateFinanceSummary(finance, items, now)
  const inventory = calculateInventoryIntelligence(items, finance, now)

  const activeListings = items.filter(item => item.status === 'Live').length
  const pendingDispatches = Math.max(
    orders.filter(waitingOrder).length,
    items.filter(item => item.status === 'Sold').length,
  )

  const soldItems = items.filter(item =>
    ['Sold', 'Dispatched', 'Archived'].includes(item.status),
  )
  const completedOrders = orders.filter(completedOrder).length
  const completedSales = Math.max(
    completedOrders,
    soldItems.filter(item => typeof item.actualSalePrice === 'number').length,
    financeSummary.salesIncome > 0
      ? finance?.transactions.filter(transaction => transaction.type === 'sale').length ?? 0
      : 0,
  )

  const denominator = inventory.activeItems + completedSales
  const sellThroughRate = denominator > 0
    ? (completedSales / denominator) * 100
    : 0

  const sellingDays = soldItems
    .map(saleDays)
    .filter((days): days is number => typeof days === 'number')

  const averageDaysToSell = sellingDays.length
    ? sellingDays.reduce((sum, days) => sum + days, 0) / sellingDays.length
    : undefined

  const linkedSales = finance?.transactions.filter(
    transaction => transaction.type === 'sale' && Boolean(transaction.sku),
  ).length ?? 0
  const recordedSales = finance?.transactions.filter(
    transaction => transaction.type === 'sale',
  ).length ?? 0

  const confidence: ExecutiveConfidence =
    recordedSales >= 12 && linkedSales >= 8 && inventory.dataQuality.score >= 85
      ? 'established'
      : recordedSales >= 3 && inventory.dataQuality.score >= 65
        ? 'developing'
        : 'limited'

  const confidenceReason =
    confidence === 'established'
      ? 'Supported by linked sales evidence and strong record completeness.'
      : confidence === 'developing'
        ? 'Some realised sales evidence exists, but conclusions should still be treated cautiously.'
        : 'Most figures are forecasts or records are incomplete; avoid treating trends as proven.'

  return {
    inventoryCost: inventory.activeCost,
    forecastRevenue: inventory.expectedSales,
    forecastGrossProfit: inventory.expectedProfit,
    realisedRevenue: financeSummary.salesIncome,
    realisedOperatingProfit: financeSummary.operatingProfit,
    cashBalance: financeSummary.cashBalance,
    cashAvailableToReinvest: financeSummary.availableSourcingBudget,
    taxReserveBalance: financeSummary.taxReserveBalance,
    activeItems: inventory.activeItems,
    activeListings,
    pendingDispatches,
    completedSales,
    sellThroughRate,
    averageForecastRoi: inventory.averageRoi,
    averageDaysToSell,
    inventoryHealth: inventory.healthScore,
    inventoryHealthLabel: inventory.healthLabel,
    dataQuality: inventory.dataQuality.score,
    confidence,
    confidenceReason,
  }
}
