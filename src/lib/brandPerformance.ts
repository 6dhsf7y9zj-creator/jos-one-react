import type {
  FinanceState,
  FinanceTransaction,
  InventoryItem,
} from '../types/inventory.ts'
import { expectedProfit, itemRoi } from './inventory.ts'
import { normaliseFinanceState } from './finance.ts'

export type BrandEvidence =
  | 'forecast-only'
  | 'limited'
  | 'developing'
  | 'established'

export type BrandRecommendation =
  | 'Buy More'
  | 'Hold'
  | 'Reduce Buying'
  | 'Exit Brand'

export type BrandPerformanceTargets = {
  targetRoi: number
  minimumProfit: number
}

export type BrandPerformance = {
  brand: string
  activeItems: number
  liveItems: number
  completedSales: number
  activeCost: number
  forecastRevenue: number
  forecastProfit: number
  averageBuyPrice: number
  averageExpectedSalePrice: number
  averageForecastRoi: number
  realisedRevenue: number
  realisedCost: number
  realisedProfit: number
  averageRealisedProfit?: number
  averageSalePrice?: number
  realisedRoi?: number
  averageDaysToSell?: number
  sellThroughRate: number
  aged60Cost: number
  aged90Cost: number
  oldestActiveDays?: number
  cashEfficiencyScore: number
  recommendation: BrandRecommendation
  recommendationReason: string
  evidence: BrandEvidence
  topCategory?: string
  topSize?: string
  warnings: string[]
}

export type BrandPerformanceReport = {
  generatedAt: string
  brands: BrandPerformance[]
  totalBrands: number
  brandsWithRealisedSales: number
  activeBrandCash: number
  aged90BrandCash: number
  realisedRevenue: number
  realisedProfit: number
  recommendationCounts: Record<BrandRecommendation, number>
  portfolioScore: number
  topRealisedBrand?: BrandPerformance
  topForecastBrand?: BrandPerformance
  fastestBrand?: BrandPerformance
  cashLockedBrand?: BrandPerformance
  dataQuality: {
    linkedSales: number
    unlinkedSales: number
    duplicateSaleLinks: number
    soldItemsWithoutLinkedSale: number
    saleDateCoverage: number
  }
  evidenceNotes: string[]
}

type LinkedSale = {
  transaction: FinanceTransaction
  item: InventoryItem
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function validDate(value?: string): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function ageDays(item: InventoryItem, now: Date): number | undefined {
  if (typeof item.daysInStock === 'number' && Number.isFinite(item.daysInStock)) {
    return Math.max(0, Math.floor(item.daysInStock))
  }
  const start = validDate(item.dateListed ?? item.dateSourced)
  if (!start) return undefined
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000))
}

function sellingDays(sale: FinanceTransaction, item: InventoryItem): number | undefined {
  const sold = validDate(sale.date)
  const started = validDate(item.dateListed ?? item.dateSourced)
  if (!sold || !started) return undefined
  return Math.max(0, Math.round((sold.getTime() - started.getTime()) / 86_400_000))
}

function average(values: number[]): number | undefined {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : undefined
}

function latestLinkedSales(
  transactions: FinanceTransaction[],
  itemMap: Map<string, InventoryItem>,
): {
  linked: LinkedSale[]
  unlinkedSales: number
  duplicateSaleLinks: number
} {
  const linkedBySku = new Map<string, LinkedSale>()
  let unlinkedSales = 0
  let duplicateSaleLinks = 0

  for (const transaction of transactions) {
    if (transaction.type !== 'sale') continue
    if (!transaction.sku) {
      unlinkedSales += 1
      continue
    }
    const item = itemMap.get(transaction.sku)
    if (!item) {
      unlinkedSales += 1
      continue
    }

    const existing = linkedBySku.get(transaction.sku)
    if (existing) {
      duplicateSaleLinks += 1
      if (transaction.date >= existing.transaction.date) {
        linkedBySku.set(transaction.sku, { transaction, item })
      }
    } else {
      linkedBySku.set(transaction.sku, { transaction, item })
    }
  }

  return {
    linked: [...linkedBySku.values()],
    unlinkedSales,
    duplicateSaleLinks,
  }
}

function evidenceLevel(completedSales: number, datedSales: number): BrandEvidence {
  const dateCoverage = completedSales > 0 ? datedSales / completedSales : 0
  if (completedSales >= 10 && dateCoverage >= .7) return 'established'
  if (completedSales >= 5) return 'developing'
  if (completedSales >= 2) return 'limited'
  return 'forecast-only'
}

function roiScore(roi: number | undefined, targetRoi: number): number {
  if (roi === undefined) return 45
  if (roi >= targetRoi * 1.25) return 100
  if (roi >= targetRoi) return 88
  if (roi >= targetRoi * .75) return 68
  if (roi >= targetRoi * .5) return 45
  if (roi >= 0) return 22
  return 0
}

function speedScore(days?: number): number {
  if (days === undefined) return 45
  if (days <= 21) return 100
  if (days <= 45) return 82
  if (days <= 75) return 58
  if (days <= 120) return 30
  return 8
}

function profitScore(profit: number | undefined, minimumProfit: number): number {
  if (profit === undefined) return 45
  if (profit >= minimumProfit * 1.5) return 100
  if (profit >= minimumProfit) return 82
  if (profit >= minimumProfit * .5) return 55
  if (profit >= 0) return 28
  return 0
}

function cashAgeScore(activeCost: number, aged60Cost: number, aged90Cost: number): number {
  if (activeCost <= 0) return 100
  const aged60Ratio = aged60Cost / activeCost
  const aged90Ratio = aged90Cost / activeCost
  return clamp(100 - aged60Ratio * 35 - aged90Ratio * 65)
}

function rankCategoryOrSize(
  linkedSales: LinkedSale[],
  activeItems: InventoryItem[],
  field: 'category' | 'size',
): string | undefined {
  const soldCounts = new Map<string, number>()
  for (const sale of linkedSales) {
    const value = sale.item[field]?.trim()
    if (value) soldCounts.set(value, (soldCounts.get(value) ?? 0) + 1)
  }
  if (soldCounts.size > 0) {
    return [...soldCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  }

  const forecast = new Map<string, number>()
  for (const item of activeItems) {
    const value = item[field]?.trim()
    if (value) {
      forecast.set(value, (forecast.get(value) ?? 0) + expectedProfit(item))
    }
  }
  return [...forecast.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

function recommendationFor(
  performance: Omit<
    BrandPerformance,
    'recommendation' | 'recommendationReason'
  >,
  targets: BrandPerformanceTargets,
): {
  recommendation: BrandRecommendation
  reason: string
} {
  const aged90Ratio = performance.activeCost > 0
    ? performance.aged90Cost / performance.activeCost
    : 0

  if (performance.completedSales < 2) {
    return {
      recommendation: 'Hold',
      reason: 'Not enough linked completed-sale evidence exists to increase buying confidently.',
    }
  }

  if (
    performance.completedSales >= 3 &&
    (performance.realisedProfit < 0 || (performance.realisedRoi ?? 0) < 30) &&
    (aged90Ratio >= .25 || performance.sellThroughRate < 25)
  ) {
    return {
      recommendation: 'Exit Brand',
      reason: 'Realised returns are weak and existing cash is moving too slowly.',
    }
  }

  if (
    (performance.realisedRoi ?? 0) < targets.targetRoi * .65 ||
    (performance.averageDaysToSell !== undefined && performance.averageDaysToSell > 75) ||
    aged90Ratio >= .35
  ) {
    return {
      recommendation: 'Reduce Buying',
      reason: 'Returns, selling speed or aged cash fall below the current buying standard.',
    }
  }

  if (
    performance.completedSales >= 3 &&
    (performance.realisedRoi ?? 0) >= targets.targetRoi &&
    (performance.averageRealisedProfit ?? 0) >= targets.minimumProfit &&
    (performance.averageDaysToSell === undefined || performance.averageDaysToSell <= 45) &&
    performance.sellThroughRate >= 35 &&
    aged90Ratio <= .2
  ) {
    return {
      recommendation: 'Buy More',
      reason: 'Linked sales support strong returns, acceptable selling speed and healthy cash movement.',
    }
  }

  return {
    recommendation: 'Hold',
    reason: 'Current evidence supports maintaining the position while more results accumulate.',
  }
}

export function calculateBrandPerformance(
  items: InventoryItem[],
  financeInput: FinanceState | undefined,
  targets: BrandPerformanceTargets,
  now = new Date(),
): BrandPerformanceReport {
  const finance = normaliseFinanceState(financeInput)
  const itemMap = new Map(items.map(item => [item.sku, item]))
  const salesResult = latestLinkedSales(finance.transactions, itemMap)
  const linkedSales = salesResult.linked
  const brands = [...new Set(items.map(item => item.brand.trim()).filter(Boolean))]

  const performance: BrandPerformance[] = brands.map(brand => {
    const brandItems = items.filter(item => item.brand === brand)
    const activeItems = brandItems.filter(
      item => !['Sold', 'Dispatched', 'Archived'].includes(item.status),
    )
    const brandSales = linkedSales.filter(sale => sale.item.brand === brand)
    const datedDays = brandSales
      .map(sale => sellingDays(sale.transaction, sale.item))
      .filter((days): days is number => days !== undefined)

    const activeAges = activeItems
      .map(item => ageDays(item, now))
      .filter((days): days is number => days !== undefined)

    const activeCost = activeItems.reduce((sum, item) => sum + item.purchasePrice, 0)
    const forecastRevenue = activeItems.reduce((sum, item) => sum + item.expectedSalePrice, 0)
    const forecastProfit = activeItems.reduce((sum, item) => sum + expectedProfit(item), 0)
    const realisedRevenue = brandSales.reduce(
      (sum, sale) => sum + Math.max(0, sale.transaction.amount),
      0,
    )
    const realisedCost = brandSales.reduce(
      (sum, sale) => sum + sale.item.purchasePrice,
      0,
    )
    const realisedProfit = realisedRevenue - realisedCost
    const completedSales = brandSales.length
    const soldAndActiveItems = [...activeItems, ...brandSales.map(sale => sale.item)]
    const aged60Cost = activeItems.reduce(
      (sum, item) => {
        const age = ageDays(item, now)
        return sum + (age !== undefined && age >= 60 ? item.purchasePrice : 0)
      },
      0,
    )
    const aged90Cost = activeItems.reduce(
      (sum, item) => {
        const age = ageDays(item, now)
        return sum + (age !== undefined && age >= 90 ? item.purchasePrice : 0)
      },
      0,
    )
    const averageRealisedProfit = completedSales > 0
      ? realisedProfit / completedSales
      : undefined
    const averageDaysToSell = average(datedDays)
    const realisedRoi = realisedCost > 0
      ? (realisedProfit / realisedCost) * 100
      : undefined
    const sellThroughRate = activeItems.length + completedSales > 0
      ? (completedSales / (activeItems.length + completedSales)) * 100
      : 0
    const evidence = evidenceLevel(completedSales, datedDays.length)

    const cashEfficiencyScore = clamp(
      roiScore(realisedRoi, targets.targetRoi) * .30 +
      speedScore(averageDaysToSell) * .20 +
      Math.min(100, sellThroughRate * 1.5) * .20 +
      profitScore(averageRealisedProfit, targets.minimumProfit) * .15 +
      cashAgeScore(activeCost, aged60Cost, aged90Cost) * .15,
    )

    const warnings: string[] = []
    if (completedSales === 0) warnings.push('No linked completed sales')
    if (completedSales > 0 && datedDays.length < completedSales) {
      warnings.push('Some sales lack usable sourced/listed dates')
    }
    if (aged90Cost > 0) warnings.push(`${aged90Cost.toFixed(2)} cash aged 90+ days`)
    if (activeItems.some(item => !item.dateSourced && !item.dateListed)) {
      warnings.push('Some active stock has no age date')
    }

    const base: Omit<
      BrandPerformance,
      'recommendation' | 'recommendationReason'
    > = {
      brand,
      activeItems: activeItems.length,
      liveItems: activeItems.filter(item => item.status === 'Live').length,
      completedSales,
      activeCost,
      forecastRevenue,
      forecastProfit,
      averageBuyPrice: soldAndActiveItems.length
        ? soldAndActiveItems.reduce((sum, item) => sum + item.purchasePrice, 0) /
          soldAndActiveItems.length
        : 0,
      averageExpectedSalePrice: activeItems.length
        ? activeItems.reduce((sum, item) => sum + item.expectedSalePrice, 0) /
          activeItems.length
        : 0,
      averageForecastRoi: activeItems.length
        ? activeItems.reduce((sum, item) => sum + itemRoi(item), 0) /
          activeItems.length
        : 0,
      realisedRevenue,
      realisedCost,
      realisedProfit,
      averageRealisedProfit,
      averageSalePrice: completedSales > 0
        ? realisedRevenue / completedSales
        : undefined,
      realisedRoi,
      averageDaysToSell,
      sellThroughRate,
      aged60Cost,
      aged90Cost,
      oldestActiveDays: activeAges.length ? Math.max(...activeAges) : undefined,
      cashEfficiencyScore,
      evidence,
      topCategory: rankCategoryOrSize(brandSales, activeItems, 'category'),
      topSize: rankCategoryOrSize(brandSales, activeItems, 'size'),
      warnings,
    }

    const recommendation = recommendationFor(base, targets)
    return {
      ...base,
      recommendation: recommendation.recommendation,
      recommendationReason: recommendation.reason,
    }
  })

  const sorted = performance.sort((a, b) => {
    const evidenceDifference = b.completedSales - a.completedSales
    if (evidenceDifference !== 0) return evidenceDifference
    return b.cashEfficiencyScore - a.cashEfficiencyScore
  })

  const recommendationCounts: Record<BrandRecommendation, number> = {
    'Buy More': 0,
    Hold: 0,
    'Reduce Buying': 0,
    'Exit Brand': 0,
  }
  sorted.forEach(brand => {
    recommendationCounts[brand.recommendation] += 1
  })

  const activeBrandCash = sorted.reduce((sum, brand) => sum + brand.activeCost, 0)
  const portfolioScore = activeBrandCash > 0
    ? clamp(
        sorted.reduce(
          (sum, brand) => sum + brand.cashEfficiencyScore * brand.activeCost,
          0,
        ) / activeBrandCash,
      )
    : sorted.length
      ? clamp(
          sorted.reduce((sum, brand) => sum + brand.cashEfficiencyScore, 0) /
          sorted.length,
        )
      : 100

  const soldItemsWithoutLinkedSale = items.filter(item =>
    ['Sold', 'Dispatched', 'Archived'].includes(item.status) &&
    !linkedSales.some(sale => sale.item.sku === item.sku),
  ).length

  const datedLinkedSales = linkedSales.filter(
    sale => sellingDays(sale.transaction, sale.item) !== undefined,
  ).length

  const realisedBrands = sorted.filter(brand => brand.completedSales > 0)
  const datedBrands = realisedBrands.filter(
    brand => brand.averageDaysToSell !== undefined && brand.completedSales >= 2,
  )

  return {
    generatedAt: now.toISOString(),
    brands: sorted,
    totalBrands: sorted.length,
    brandsWithRealisedSales: realisedBrands.length,
    activeBrandCash,
    aged90BrandCash: sorted.reduce((sum, brand) => sum + brand.aged90Cost, 0),
    realisedRevenue: sorted.reduce((sum, brand) => sum + brand.realisedRevenue, 0),
    realisedProfit: sorted.reduce((sum, brand) => sum + brand.realisedProfit, 0),
    recommendationCounts,
    portfolioScore,
    topRealisedBrand: [...realisedBrands].sort(
      (a, b) => b.realisedProfit - a.realisedProfit,
    )[0],
    topForecastBrand: [...sorted].sort(
      (a, b) => b.forecastProfit - a.forecastProfit,
    )[0],
    fastestBrand: [...datedBrands].sort(
      (a, b) => (a.averageDaysToSell ?? Infinity) -
        (b.averageDaysToSell ?? Infinity),
    )[0],
    cashLockedBrand: [...sorted].sort(
      (a, b) => b.activeCost - a.activeCost,
    )[0],
    dataQuality: {
      linkedSales: linkedSales.length,
      unlinkedSales: salesResult.unlinkedSales,
      duplicateSaleLinks: salesResult.duplicateSaleLinks,
      soldItemsWithoutLinkedSale,
      saleDateCoverage: linkedSales.length > 0
        ? (datedLinkedSales / linkedSales.length) * 100
        : 0,
    },
    evidenceNotes: [
      'Buy More requires at least three linked sales plus returns, profit and selling speed that meet current targets.',
      'Forecast-only brands remain Hold because expected ROI is not proof of customer demand.',
      'One linked sale per SKU is used; duplicate sale links are reported instead of double-counted.',
      'Average days to sell is calculated only when a sale date and a sourced or listed date both exist.',
    ],
  }
}
