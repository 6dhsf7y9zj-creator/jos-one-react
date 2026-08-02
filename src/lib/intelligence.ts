import type { FinanceState, FinanceTransaction, InventoryItem } from '../types/inventory'
import { expectedProfit, itemRoi } from './inventory'
import { calculateFinanceSummary, normaliseFinanceState } from './finance'

export type IntelligenceTone = 'positive' | 'warning' | 'urgent' | 'neutral'

export type IntelligenceInsight = {
  id: string
  title: string
  detail: string
  recommendation: string
  tone: IntelligenceTone
  destination: 'inventory' | 'finance' | 'sourcecheck' | 'orders'
}

export type BrandIntelligence = {
  brand: string
  activeItems: number
  activeCost: number
  forecastProfit: number
  averageForecastRoi: number
  realisedSales: number
  realisedRevenue: number
  realisedProfit: number
  averageDaysToSell?: number
  dataConfidence: 'forecast-only' | 'limited' | 'developing'
}

export type MonthlyTrend = {
  key: string
  label: string
  sales: number
  expenses: number
  profit: number
}

export type BusinessIntelligence = {
  insights: IntelligenceInsight[]
  brands: BrandIntelligence[]
  monthlyTrend: MonthlyTrend[]
  ageing: {
    under30: number
    days30to59: number
    days60to89: number
    days90plus: number
    cost60plus: number
    forecastProfit60plus: number
  }
  pipeline: {
    prepCost: number
    photographedValue: number
    liveValue: number
    liveCount: number
    conversionEvidence: number
  }
  sourcing: {
    averagePurchaseCost: number
    affordableItems: number
    recommendedBrands: string[]
    avoidBrands: string[]
  }
  dataQuality: {
    score: number
    linkedSales: number
    totalSales: number
    salesWithDates: number
    inventoryWithDates: number
    missingStorage: number
    missingActualSalePrice: number
  }
}

function dateValue(value?: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function daysBetween(start?: string, end?: string): number | undefined {
  const a = dateValue(start)
  const b = dateValue(end)
  if (!a || !b) return undefined
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000))
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

function saleCost(transaction: FinanceTransaction, itemsBySku: Map<string, InventoryItem>): number {
  if (transaction.type !== 'sale' || !transaction.sku) return 0
  return itemsBySku.get(transaction.sku)?.purchasePrice ?? 0
}

function saleDays(transaction: FinanceTransaction, itemsBySku: Map<string, InventoryItem>): number | undefined {
  if (transaction.type !== 'sale' || !transaction.sku) return undefined
  const item = itemsBySku.get(transaction.sku)
  if (!item) return undefined
  return daysBetween(item.dateListed ?? item.dateSourced, transaction.date)
}

function activeAge(item: InventoryItem, now: Date): number {
  if (typeof item.daysInStock === 'number' && Number.isFinite(item.daysInStock)) return Math.max(0, item.daysInStock)
  const start = dateValue(item.dateListed ?? item.dateSourced)
  if (!start) return 0
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000))
}

export function calculateBusinessIntelligence(
  items: InventoryItem[],
  financeInput?: FinanceState,
  now = new Date(),
): BusinessIntelligence {
  const finance = normaliseFinanceState(financeInput)
  const financeSummary = calculateFinanceSummary(finance, items, now)
  const itemsBySku = new Map(items.map(item => [item.sku, item]))
  const activeItems = items.filter(item => !['Dispatched', 'Archived'].includes(item.status))
  const sales = finance.transactions.filter(transaction => transaction.type === 'sale')
  const expenses = finance.transactions.filter(transaction => transaction.type === 'expense')

  const brandMap = new Map<string, BrandIntelligence & { roiSum: number; daysSum: number; daysCount: number }>()
  for (const item of activeItems) {
    const entry = brandMap.get(item.brand) ?? {
      brand: item.brand, activeItems: 0, activeCost: 0, forecastProfit: 0,
      averageForecastRoi: 0, realisedSales: 0, realisedRevenue: 0, realisedProfit: 0,
      dataConfidence: 'forecast-only' as const, roiSum: 0, daysSum: 0, daysCount: 0,
    }
    entry.activeItems += 1
    entry.activeCost += item.purchasePrice
    entry.forecastProfit += expectedProfit(item)
    entry.roiSum += itemRoi(item)
    brandMap.set(item.brand, entry)
  }

  for (const sale of sales) {
    if (!sale.sku) continue
    const item = itemsBySku.get(sale.sku)
    if (!item) continue
    const entry = brandMap.get(item.brand) ?? {
      brand: item.brand, activeItems: 0, activeCost: 0, forecastProfit: 0,
      averageForecastRoi: 0, realisedSales: 0, realisedRevenue: 0, realisedProfit: 0,
      dataConfidence: 'forecast-only' as const, roiSum: 0, daysSum: 0, daysCount: 0,
    }
    entry.realisedSales += 1
    entry.realisedRevenue += sale.amount
    entry.realisedProfit += sale.amount - item.purchasePrice
    const days = saleDays(sale, itemsBySku)
    if (typeof days === 'number') { entry.daysSum += days; entry.daysCount += 1 }
    brandMap.set(item.brand, entry)
  }

  const brands: BrandIntelligence[] = [...brandMap.values()].map(entry => ({
    brand: entry.brand,
    activeItems: entry.activeItems,
    activeCost: entry.activeCost,
    forecastProfit: entry.forecastProfit,
    averageForecastRoi: entry.activeItems ? entry.roiSum / entry.activeItems : 0,
    realisedSales: entry.realisedSales,
    realisedRevenue: entry.realisedRevenue,
    realisedProfit: entry.realisedProfit,
    averageDaysToSell: entry.daysCount ? entry.daysSum / entry.daysCount : undefined,
    dataConfidence: entry.realisedSales >= 5 ? 'developing' : entry.realisedSales > 0 ? 'limited' : 'forecast-only',
  })).sort((a, b) => (b.realisedProfit || b.forecastProfit) - (a.realisedProfit || a.forecastProfit))

  const months: MonthlyTrend[] = []
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    months.push({ key: monthKey(date), label: monthLabel(date), sales: 0, expenses: 0, profit: 0 })
  }
  const monthMap = new Map(months.map(month => [month.key, month]))
  for (const transaction of finance.transactions) {
    const date = dateValue(transaction.date)
    if (!date) continue
    const month = monthMap.get(monthKey(date))
    if (!month) continue
    if (transaction.type === 'sale') {
      month.sales += transaction.amount
      month.profit += transaction.amount - saleCost(transaction, itemsBySku)
    } else if (transaction.type === 'expense') {
      month.expenses += transaction.amount
      month.profit -= transaction.amount
    }
  }

  const ageing = { under30: 0, days30to59: 0, days60to89: 0, days90plus: 0, cost60plus: 0, forecastProfit60plus: 0 }
  for (const item of activeItems) {
    const age = activeAge(item, now)
    if (age < 30) ageing.under30 += 1
    else if (age < 60) ageing.days30to59 += 1
    else if (age < 90) ageing.days60to89 += 1
    else ageing.days90plus += 1
    if (age >= 60) {
      ageing.cost60plus += item.purchasePrice
      ageing.forecastProfit60plus += expectedProfit(item)
    }
  }

  const prepItems = activeItems.filter(item => item.status === 'Prep')
  const photographedItems = activeItems.filter(item => item.status === 'Photographed')
  const liveItems = activeItems.filter(item => item.status === 'Live')
  const soldEvidence = sales.filter(sale => sale.sku && itemsBySku.has(sale.sku)).length
  const conversionEvidence = liveItems.length + soldEvidence > 0 ? (soldEvidence / (liveItems.length + soldEvidence)) * 100 : 0

  const averagePurchaseCost = activeItems.length ? activeItems.reduce((sum, item) => sum + item.purchasePrice, 0) / activeItems.length : 0
  const affordableItems = averagePurchaseCost > 0 ? Math.floor(financeSummary.availableSourcingBudget / averagePurchaseCost) : 0
  const realisedBrands = brands.filter(brand => brand.realisedSales > 0)
  const recommendedBrands = realisedBrands.length
    ? [...realisedBrands].sort((a, b) => b.realisedProfit - a.realisedProfit).slice(0, 3).map(brand => brand.brand)
    : brands.slice(0, 3).map(brand => brand.brand)
  const avoidBrands = brands.filter(brand => brand.activeItems >= 2 && brand.averageForecastRoi < 100).slice(-3).map(brand => brand.brand)

  const linkedSales = sales.filter(sale => sale.sku && itemsBySku.has(sale.sku)).length
  const salesWithDates = sales.filter(sale => Boolean(dateValue(sale.date))).length
  const inventoryWithDates = items.filter(item => Boolean(dateValue(item.dateSourced ?? item.dateListed))).length
  const missingStorage = activeItems.filter(item => !item.storageLocation || item.storageLocation.toUpperCase() === 'TBC').length
  const missingActualSalePrice = items.filter(item => ['Sold', 'Dispatched', 'Archived'].includes(item.status) && typeof item.actualSalePrice !== 'number').length
  const completenessParts = [
    sales.length ? linkedSales / sales.length : 1,
    sales.length ? salesWithDates / sales.length : 1,
    items.length ? inventoryWithDates / items.length : 1,
    activeItems.length ? 1 - missingStorage / activeItems.length : 1,
    1 - Math.min(1, missingActualSalePrice / Math.max(1, items.length)),
  ]
  const dataScore = Math.round(completenessParts.reduce((sum, value) => sum + Math.max(0, value), 0) / completenessParts.length * 100)

  const insights: IntelligenceInsight[] = []
  if (ageing.days90plus > 0) insights.push({ id: 'old-stock', title: `${ageing.days90plus} items are 90+ days old`, detail: `${formatMoney(ageing.cost60plus)} is tied in stock aged 60 days or more.`, recommendation: 'Review price, photos, demand and whether to move items into Exit stock.', tone: 'urgent', destination: 'inventory' })
  else if (ageing.days60to89 > 0) insights.push({ id: 'ageing-stock', title: `${ageing.days60to89} items are entering slow-stock territory`, detail: 'These items are 60–89 days old based on recorded dates or days-in-stock.', recommendation: 'Prioritise relisting, price testing or bundling before they become dead stock.', tone: 'warning', destination: 'inventory' })

  if (photographedItems.length > 0) insights.push({ id: 'listing-opportunity', title: `${photographedItems.length} photographed items are not yet live`, detail: `${formatMoney(photographedItems.reduce((sum, item) => sum + item.expectedSalePrice, 0))} of forecast sales value is waiting to be listed.`, recommendation: 'List the highest-profit photographed stock first.', tone: 'positive', destination: 'inventory' })

  if (financeSummary.availableSourcingBudget > 0 && affordableItems > 0) insights.push({ id: 'sourcing-capacity', title: `Current budget supports about ${affordableItems} average-cost items`, detail: `Available sourcing budget is ${formatMoney(financeSummary.availableSourcingBudget)} at an average active-stock cost of ${formatMoney(averagePurchaseCost)}.`, recommendation: 'Use SourceCheck and do not treat this as a spending target.', tone: 'neutral', destination: 'sourcecheck' })

  if (expenses.length >= 2) {
    const recent = months[months.length - 1]
    const previous = months[months.length - 2]
    if (previous.expenses > 0 && recent.expenses > previous.expenses * 1.2) insights.push({ id: 'expense-rise', title: 'Expenses increased by more than 20% month on month', detail: `${recent.label} expenses are ${formatMoney(recent.expenses)} versus ${formatMoney(previous.expenses)} previously.`, recommendation: 'Review the ledger by expense type before increasing sourcing.', tone: 'warning', destination: 'finance' })
  }

  if (dataScore < 70) insights.push({ id: 'data-quality', title: `Decision confidence is limited (${dataScore}/100)`, detail: 'Missing dates, SKU links, storage locations or actual sale values weaken the analysis.', recommendation: 'Improve data quality before relying on brand rankings or sell-through signals.', tone: 'warning', destination: 'inventory' })
  else insights.push({ id: 'data-quality-good', title: `Decision data is ${dataScore >= 90 ? 'strong' : 'usable'} (${dataScore}/100)`, detail: 'JOS can support increasingly reliable analysis as completed sales accumulate.', recommendation: 'Keep linking every sale to its SKU and recording dates.', tone: 'positive', destination: 'finance' })

  if (realisedBrands.length === 0) insights.push({ id: 'forecast-warning', title: 'Brand rankings are forecast-only', detail: 'No linked sales are available to prove which brands sell fastest or generate the most realised profit.', recommendation: 'Link each Finance sale entry to an inventory SKU.', tone: 'neutral', destination: 'finance' })
  else {
    const best = [...realisedBrands].sort((a, b) => b.realisedProfit - a.realisedProfit)[0]
    insights.push({ id: 'best-brand', title: `${best.brand} leads recorded realised brand profit`, detail: `${formatMoney(best.realisedProfit)} across ${best.realisedSales} linked sale${best.realisedSales === 1 ? '' : 's'}.`, recommendation: best.realisedSales < 5 ? 'Treat this as early evidence, not a settled sourcing rule.' : 'Compare this with days-to-sell before increasing buying.', tone: 'positive', destination: 'sourcecheck' })
  }

  return {
    insights: insights.slice(0, 6), brands, monthlyTrend: months, ageing,
    pipeline: {
      prepCost: prepItems.reduce((sum, item) => sum + item.purchasePrice, 0),
      photographedValue: photographedItems.reduce((sum, item) => sum + item.expectedSalePrice, 0),
      liveValue: liveItems.reduce((sum, item) => sum + item.expectedSalePrice, 0),
      liveCount: liveItems.length, conversionEvidence,
    },
    sourcing: { averagePurchaseCost, affordableItems, recommendedBrands, avoidBrands },
    dataQuality: { score: dataScore, linkedSales, totalSales: sales.length, salesWithDates, inventoryWithDates, missingStorage, missingActualSalePrice },
  }
}

export function formatMoney(value: number): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}£${Math.abs(value).toFixed(2)}`
}
