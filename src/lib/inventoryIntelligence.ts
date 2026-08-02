import type {
  FinanceState,
  FinanceTransaction,
  InventoryItem,
} from '../types/inventory'
import { expectedProfit, itemRoi } from './inventory'
import { normaliseFinanceState } from './finance'
import { inferPipelineStage, pipelineReadiness } from './pipeline'

export type IntelligenceGrade = InventoryItem['grade']
export type InventoryHealthBand = 'healthy' | 'monitor' | 'attention' | 'exit'
export type InventoryAction =
  | 'Dispatch'
  | 'Upload'
  | 'Write listing'
  | 'Photograph'
  | 'Prepare'
  | 'Review price'
  | 'Add measurements'
  | 'Assign storage'
  | 'Monitor'

export type InventoryItemIntelligence = {
  sku: string
  item: InventoryItem
  ageDays?: number
  forecastProfit: number
  forecastRoi: number
  readiness: number
  qualityScore: number
  healthScore: number
  healthBand: InventoryHealthBand
  recommendedGrade: IntelligenceGrade
  gradeChanged: boolean
  recommendedAction: InventoryAction
  actionReason: string
  priorityScore: number
  cashLocked: number
  missingFields: string[]
  realisedSalesEvidence: number
  realisedBrandProfit: number
}

export type DuplicateCandidate = {
  leftSku: string
  rightSku: string
  confidence: 'strong' | 'possible'
  reason: string
}

export type InventoryBrandIntelligence = {
  brand: string
  activeItems: number
  activeCost: number
  forecastProfit: number
  averageForecastRoi: number
  realisedSales: number
  realisedProfit: number
  averageDaysToSell?: number
  evidence: 'forecast-only' | 'limited' | 'developing'
}

export type InventoryIntelligenceReport = {
  generatedAt: string
  healthScore: number
  healthLabel: string
  activeItems: number
  activeCost: number
  expectedSales: number
  expectedProfit: number
  averageRoi: number
  grades: Record<IntelligenceGrade, number>
  healthBands: Record<InventoryHealthBand, {
    items: number
    cost: number
  }>
  ageing: {
    under30: number
    days30to59: number
    days60to89: number
    days90plus: number
    unknown: number
  }
  priorities: InventoryItemIntelligence[]
  items: InventoryItemIntelligence[]
  brands: InventoryBrandIntelligence[]
  duplicateCandidates: DuplicateCandidate[]
  storage: {
    missing: number
    locations: Array<{ location: string; items: number }>
  }
  dataQuality: {
    score: number
    missingDates: number
    missingStorage: number
    missingMeasurements: number
    soldWithoutActualPrice: number
    unlinkedSales: number
  }
  evidenceNotes: string[]
}

function validDate(value?: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function itemAge(item: InventoryItem, now: Date): number | undefined {
  if (typeof item.daysInStock === 'number' && Number.isFinite(item.daysInStock)) {
    return Math.max(0, Math.floor(item.daysInStock))
  }
  const start = validDate(item.dateListed ?? item.dateSourced)
  if (!start) return undefined
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000))
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function scoreRoi(roi: number): number {
  if (roi >= 250) return 100
  if (roi >= 175) return 88
  if (roi >= 125) return 72
  if (roi >= 75) return 52
  if (roi >= 35) return 30
  return 8
}

function scoreAge(age?: number): number {
  if (age === undefined) return 50
  if (age < 30) return 100
  if (age < 60) return 80
  if (age < 90) return 55
  if (age < 120) return 30
  return 8
}

function missingFields(item: InventoryItem): string[] {
  const missing: string[] = []
  if (!item.storageLocation || item.storageLocation.trim().toUpperCase() === 'TBC') missing.push('storage')
  if (!item.condition || item.condition.trim().length < 3) missing.push('condition')
  if (!item.size || item.size.trim().length === 0) missing.push('size')
  if (!item.photoChecklist?.measurements && !item.listingChecklist?.measurements) missing.push('measurements')
  if (!item.dateSourced && !item.dateListed) missing.push('date')
  if (!item.category || item.category.trim().length === 0) missing.push('category')
  return missing
}

function listingQuality(item: InventoryItem): number {
  const missing = missingFields(item)
  let score = 100 - missing.length * 13
  if (item.photoChecklist) {
    const values = Object.values(item.photoChecklist)
    score += (values.filter(Boolean).length / values.length) * 8
  }
  if (item.listingChecklist) {
    const values = Object.values(item.listingChecklist)
    score += (values.filter(Boolean).length / values.length) * 8
  }
  return clamp(score)
}

function healthBand(score: number, age?: number, roi = 0): InventoryHealthBand {
  if ((age !== undefined && age >= 120) || roi < 35 || score < 35) return 'exit'
  if (score < 55 || (age !== undefined && age >= 90)) return 'attention'
  if (score < 75 || (age !== undefined && age >= 60)) return 'monitor'
  return 'healthy'
}

function recommendedGrade(
  score: number,
  band: InventoryHealthBand,
  age: number | undefined,
  roi: number,
): IntelligenceGrade {
  if (band === 'exit' || (age !== undefined && age >= 120) || roi < 35) return 'Exit'
  if (score >= 82 && roi >= 150 && (age === undefined || age < 60)) return 'A'
  if (score >= 62 && roi >= 90) return 'B'
  return 'C'
}

function recommendation(item: InventoryItem, age: number | undefined, missing: string[]): {
  action: InventoryAction
  reason: string
  basePriority: number
} {
  if (item.status === 'Sold') {
    return { action: 'Dispatch', reason: 'The item is sold and remains a customer commitment.', basePriority: 100 }
  }

  const stage = inferPipelineStage(item)
  if (stage === 'Ready to Upload') {
    return { action: 'Upload', reason: 'The record is ready to become a live listing.', basePriority: 90 }
  }
  if (stage === 'Listing Copy') {
    return { action: 'Write listing', reason: 'Photography is complete; listing copy is the next constraint.', basePriority: 82 }
  }
  if (stage === 'Photography' || stage === 'Photo Review') {
    return { action: 'Photograph', reason: 'Photography work is blocking listing readiness.', basePriority: 76 }
  }
  if (stage === 'Preparation') {
    return { action: 'Prepare', reason: 'The item has not yet reached photography.', basePriority: 68 }
  }
  if (missing.includes('measurements')) {
    return { action: 'Add measurements', reason: 'Missing measurements weaken listing quality.', basePriority: 64 }
  }
  if (missing.includes('storage')) {
    return { action: 'Assign storage', reason: 'A missing location increases fulfilment risk.', basePriority: 58 }
  }
  if (item.status === 'Live' && age !== undefined && age >= 60) {
    return { action: 'Review price', reason: `The live listing is ${age} days old and cash is slowing down.`, basePriority: 72 }
  }
  return { action: 'Monitor', reason: 'No immediate operational intervention is supported by current data.', basePriority: 20 }
}

function words(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 3),
  )
}

function wordOverlap(a: string, b: string): number {
  const left = words(a)
  const right = words(b)
  if (!left.size || !right.size) return 0
  const intersection = [...left].filter(word => right.has(word)).length
  return intersection / Math.min(left.size, right.size)
}

function normal(value?: string): string {
  return (value ?? '').trim().toLowerCase()
}

function duplicateCandidates(items: InventoryItem[]): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = []
  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      const left = items[leftIndex]
      const right = items[rightIndex]
      if (left.sku === right.sku) {
        candidates.push({
          leftSku: left.sku,
          rightSku: right.sku,
          confidence: 'strong',
          reason: 'The same SKU appears more than once.',
        })
        continue
      }

      const sameCore =
        normal(left.brand) === normal(right.brand) &&
        normal(left.category) === normal(right.category) &&
        normal(left.size) === normal(right.size)
      if (!sameCore) continue

      const sameColour = normal(left.colour) && normal(left.colour) === normal(right.colour)
      const overlap = wordOverlap(
        `${left.description} ${left.notes ?? ''}`,
        `${right.description} ${right.notes ?? ''}`,
      )

      if (sameColour && overlap >= .55) {
        candidates.push({
          leftSku: left.sku,
          rightSku: right.sku,
          confidence: 'strong',
          reason: 'Brand, category, size, colour and description are very similar.',
        })
      } else if (sameColour || overlap >= .55) {
        candidates.push({
          leftSku: left.sku,
          rightSku: right.sku,
          confidence: 'possible',
          reason: sameColour
            ? 'Brand, category, size and colour match.'
            : 'Brand, category and size match with a similar description.',
        })
      }
    }
  }
  return candidates.slice(0, 20)
}

function saleDays(
  sale: FinanceTransaction,
  item: InventoryItem,
): number | undefined {
  const sold = validDate(sale.date)
  const started = validDate(item.dateListed ?? item.dateSourced)
  if (!sold || !started) return undefined
  return Math.max(0, Math.round((sold.getTime() - started.getTime()) / 86_400_000))
}

export function calculateInventoryIntelligence(
  items: InventoryItem[],
  financeInput?: FinanceState,
  now = new Date(),
): InventoryIntelligenceReport {
  const finance = normaliseFinanceState(financeInput)
  const activeItems = items.filter(item => !['Dispatched', 'Archived'].includes(item.status))
  const itemMap = new Map(items.map(item => [item.sku, item]))
  const sales = finance.transactions.filter(transaction => transaction.type === 'sale')

  const brandEvidence = new Map<string, {
    realisedSales: number
    realisedProfit: number
    days: number[]
  }>()

  for (const sale of sales) {
    if (!sale.sku) continue
    const item = itemMap.get(sale.sku)
    if (!item) continue
    const evidence = brandEvidence.get(item.brand) ?? {
      realisedSales: 0,
      realisedProfit: 0,
      days: [],
    }
    evidence.realisedSales += 1
    evidence.realisedProfit += sale.amount - item.purchasePrice
    const days = saleDays(sale, item)
    if (days !== undefined) evidence.days.push(days)
    brandEvidence.set(item.brand, evidence)
  }

  const intelligenceItems: InventoryItemIntelligence[] = activeItems.map(item => {
    const age = itemAge(item, now)
    const roi = itemRoi(item)
    const profit = expectedProfit(item)
    const readiness = pipelineReadiness(item)
    const quality = listingQuality(item)
    const evidence = brandEvidence.get(item.brand)
    const evidenceScore = evidence
      ? Math.min(100, evidence.realisedSales * 15 + Math.max(0, evidence.realisedProfit) * 1.5)
      : 0
    const score = clamp(
      scoreRoi(roi) * .32 +
      scoreAge(age) * .24 +
      quality * .19 +
      readiness * .15 +
      evidenceScore * .10,
    )
    const band = healthBand(score, age, roi)
    const grade = recommendedGrade(score, band, age, roi)
    const missing = missingFields(item)
    const next = recommendation(item, age, missing)
    const priorityScore = clamp(
      next.basePriority +
      Math.min(18, Math.max(0, profit)) * .45 +
      (age !== undefined && age >= 60 ? 8 : 0) +
      missing.length * 2,
    )

    return {
      sku: item.sku,
      item,
      ageDays: age,
      forecastProfit: profit,
      forecastRoi: roi,
      readiness,
      qualityScore: quality,
      healthScore: score,
      healthBand: band,
      recommendedGrade: grade,
      gradeChanged: grade !== item.grade,
      recommendedAction: next.action,
      actionReason: next.reason,
      priorityScore,
      cashLocked: item.purchasePrice,
      missingFields: missing,
      realisedSalesEvidence: evidence?.realisedSales ?? 0,
      realisedBrandProfit: evidence?.realisedProfit ?? 0,
    }
  })

  const healthBands: InventoryIntelligenceReport['healthBands'] = {
    healthy: { items: 0, cost: 0 },
    monitor: { items: 0, cost: 0 },
    attention: { items: 0, cost: 0 },
    exit: { items: 0, cost: 0 },
  }
  const grades: Record<IntelligenceGrade, number> = { A: 0, B: 0, C: 0, Exit: 0 }
  const ageing = { under30: 0, days30to59: 0, days60to89: 0, days90plus: 0, unknown: 0 }

  for (const entry of intelligenceItems) {
    healthBands[entry.healthBand].items += 1
    healthBands[entry.healthBand].cost += entry.cashLocked
    grades[entry.recommendedGrade] += 1

    if (entry.ageDays === undefined) ageing.unknown += 1
    else if (entry.ageDays < 30) ageing.under30 += 1
    else if (entry.ageDays < 60) ageing.days30to59 += 1
    else if (entry.ageDays < 90) ageing.days60to89 += 1
    else ageing.days90plus += 1
  }

  const brands: InventoryBrandIntelligence[] = [...new Set(items.map(item => item.brand))]
    .map(brand => {
      const active = activeItems.filter(item => item.brand === brand)
      const evidence = brandEvidence.get(brand)
      return {
        brand,
        activeItems: active.length,
        activeCost: active.reduce((sum, item) => sum + item.purchasePrice, 0),
        forecastProfit: active.reduce((sum, item) => sum + expectedProfit(item), 0),
        averageForecastRoi: active.length
          ? active.reduce((sum, item) => sum + itemRoi(item), 0) / active.length
          : 0,
        realisedSales: evidence?.realisedSales ?? 0,
        realisedProfit: evidence?.realisedProfit ?? 0,
        averageDaysToSell: evidence?.days.length
          ? evidence.days.reduce((sum, days) => sum + days, 0) / evidence.days.length
          : undefined,
        evidence:
          (evidence?.realisedSales ?? 0) >= 5
            ? 'developing'
            : (evidence?.realisedSales ?? 0) > 0
              ? 'limited'
              : 'forecast-only',
      }
    })
    .sort((a, b) =>
      (b.realisedSales ? b.realisedProfit : b.forecastProfit) -
      (a.realisedSales ? a.realisedProfit : a.forecastProfit),
    )

  const missingDates = intelligenceItems.filter(entry => entry.missingFields.includes('date')).length
  const missingStorage = intelligenceItems.filter(entry => entry.missingFields.includes('storage')).length
  const missingMeasurements = intelligenceItems.filter(entry => entry.missingFields.includes('measurements')).length
  const soldWithoutActualPrice = items.filter(
    item => ['Sold', 'Dispatched', 'Archived'].includes(item.status) &&
      typeof item.actualSalePrice !== 'number',
  ).length
  const unlinkedSales = sales.filter(sale => !sale.sku || !itemMap.has(sale.sku)).length

  const qualityParts = [
    activeItems.length ? 1 - missingDates / activeItems.length : 1,
    activeItems.length ? 1 - missingStorage / activeItems.length : 1,
    activeItems.length ? 1 - missingMeasurements / activeItems.length : 1,
    items.length ? 1 - soldWithoutActualPrice / items.length : 1,
    sales.length ? 1 - unlinkedSales / sales.length : 1,
  ]
  const dataQualityScore = clamp(
    qualityParts.reduce((sum, value) => sum + Math.max(0, value), 0) /
      qualityParts.length * 100,
  )

  const activeCost = activeItems.reduce((sum, item) => sum + item.purchasePrice, 0)
  const expectedSales = activeItems.reduce((sum, item) => sum + item.expectedSalePrice, 0)
  const expectedProfitTotal = activeItems.reduce((sum, item) => sum + expectedProfit(item), 0)
  const averageRoi = activeItems.length
    ? activeItems.reduce((sum, item) => sum + itemRoi(item), 0) / activeItems.length
    : 0
  const weightedHealth = activeCost > 0
    ? intelligenceItems.reduce(
        (sum, entry) => sum + entry.healthScore * entry.cashLocked,
        0,
      ) / activeCost
    : intelligenceItems.length
      ? intelligenceItems.reduce((sum, entry) => sum + entry.healthScore, 0) /
        intelligenceItems.length
      : 100
  const healthScore = clamp(weightedHealth * .85 + dataQualityScore * .15)

  const storageMap = new Map<string, number>()
  for (const item of activeItems) {
    const location = item.storageLocation?.trim() || 'TBC'
    storageMap.set(location, (storageMap.get(location) ?? 0) + 1)
  }

  return {
    generatedAt: now.toISOString(),
    healthScore,
    healthLabel:
      healthScore >= 85
        ? 'Excellent'
        : healthScore >= 70
          ? 'Healthy'
          : healthScore >= 55
            ? 'Needs attention'
            : 'Cash at risk',
    activeItems: activeItems.length,
    activeCost,
    expectedSales,
    expectedProfit: expectedProfitTotal,
    averageRoi,
    grades,
    healthBands,
    ageing,
    priorities: [...intelligenceItems]
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 12),
    items: intelligenceItems,
    brands,
    duplicateCandidates: duplicateCandidates(items),
    storage: {
      missing: missingStorage,
      locations: [...storageMap.entries()]
        .map(([location, itemCount]) => ({ location, items: itemCount }))
        .sort((a, b) => b.items - a.items),
    },
    dataQuality: {
      score: dataQualityScore,
      missingDates,
      missingStorage,
      missingMeasurements,
      soldWithoutActualPrice,
      unlinkedSales,
    },
    evidenceNotes: [
      'Recommended grades are advisory and do not replace your saved stock grade unless you apply them.',
      'Forecast ROI and profit are assumptions until a sale is recorded.',
      'Fast-selling and realised brand evidence require sales linked to inventory SKUs and usable dates.',
      'Similar-item detection is a warning for review, not proof that two listings are duplicates.',
    ],
  }
}
