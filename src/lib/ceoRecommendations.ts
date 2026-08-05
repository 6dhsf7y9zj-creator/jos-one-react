import type {
  InventoryItem,
  JosSettings,
  OrderRecord,
  StockStatus,
} from '../types/inventory'
import { calculateBrandPerformance, type BrandPerformance } from './brandPerformance'
import { calculateFinanceSummary } from './finance'
import {
  calculateInventoryIntelligence,
  type InventoryItemIntelligence,
} from './inventoryIntelligence'
import { calculateOperations } from './operations'

export type CeoRecommendationDestination =
  | 'orders'
  | 'pipeline'
  | 'inventory'
  | 'finance'
  | 'brand-performance'
  | 'inventory-intelligence'
  | 'sourcecheck'
  | 'operations'

export type CeoRecommendationCategory =
  | 'customer'
  | 'revenue'
  | 'cash'
  | 'finance'
  | 'quality'
  | 'sourcing'
  | 'risk'

export type CeoRecommendationUrgency =
  | 'critical'
  | 'high'
  | 'medium'
  | 'opportunity'

export type CeoRecommendationConfidence = 'high' | 'medium' | 'low'

export type CeoRecommendationImpact = {
  protectedRevenue?: number
  forecastProfit?: number
  cashUnderReview?: number
  safeSpendLimit?: number
}

export type CeoRecommendation = {
  id: string
  title: string
  detail: string
  reason: string
  actionLabel: string
  destination: CeoRecommendationDestination
  category: CeoRecommendationCategory
  urgency: CeoRecommendationUrgency
  confidence: CeoRecommendationConfidence
  confidenceReason: string
  priority: number
  minutes: number
  status?: StockStatus
  brand?: string
  skus?: string[]
  impact: CeoRecommendationImpact
  evidence: string[]
}

export type SourcingDecision = 'blocked' | 'hold' | 'selective'

export type CeoRecommendationReport = {
  generatedAt: string
  allRecommendations: CeoRecommendation[]
  todayPlan: CeoRecommendation[]
  deferred: CeoRecommendation[]
  planMinutes: number
  dailyCapacityMinutes: number
  protectedRevenue: number
  forecastProfitUnlocked: number
  cashUnderReview: number
  safeSourcingLimit: number
  sourcingDecision: SourcingDecision
  sourcingHeadline: string
  sourcingReason: string
  decisionConfidence: CeoRecommendationConfidence
  decisionConfidenceScore: number
  decisionConfidenceReason: string
  operationalBacklog: number
  evidence: {
    inventoryDataQuality: number
    inventoryHealth: number
    linkedSales: number
    unlinkedSales: number
    brandsWithRealisedSales: number
    financeTransactions: number
    waitingOrders: number
    pipelineWaiting: number
  }
  rules: string[]
}

const FINAL_ORDER_STATUS =
  /dispatched|delivered|completed|archived|cancelled|refunded|returned/i

function activeOrder(order: OrderRecord): boolean {
  return !FINAL_ORDER_STATUS.test(order.status)
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function money(value: number): string {
  return `£${Math.max(0, value).toFixed(2)}`
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function topEntries(
  entries: InventoryItemIntelligence[],
  action: InventoryItemIntelligence['recommendedAction'],
  limit: number,
): InventoryItemIntelligence[] {
  return entries
    .filter(entry => entry.recommendedAction === action)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit)
}

function totalProfit(entries: InventoryItemIntelligence[]): number {
  return entries.reduce((sum, entry) => sum + Math.max(0, entry.forecastProfit), 0)
}

function entrySkus(entries: InventoryItemIntelligence[]): string[] {
  return entries.map(entry => entry.sku)
}

function confidenceFromData(
  inventoryDataQuality: number,
  linkedSales: number,
  brandsWithRealisedSales: number,
  financeTransactions: number,
): {
  confidence: CeoRecommendationConfidence
  score: number
  reason: string
} {
  const salesEvidence = Math.min(100, linkedSales * 10)
  const brandEvidence = Math.min(100, brandsWithRealisedSales * 20)
  const financeEvidence = Math.min(100, financeTransactions * 8)
  const score = clamp(
    inventoryDataQuality * .48 +
    salesEvidence * .24 +
    brandEvidence * .13 +
    financeEvidence * .15,
  )

  if (score >= 78) {
    return {
      confidence: 'high',
      score,
      reason: 'Inventory records and linked trading evidence are strong enough for confident operational decisions.',
    }
  }
  if (score >= 52) {
    return {
      confidence: 'medium',
      score,
      reason: 'Operational recommendations are usable, but some brand or finance conclusions still need more linked evidence.',
    }
  }
  return {
    confidence: 'low',
    score,
    reason: 'Priorities use recorded workflow facts, but wider profit and sourcing conclusions remain limited by incomplete evidence.',
  }
}

function brandEvidenceConfidence(
  brand: BrandPerformance,
): CeoRecommendationConfidence {
  if (brand.evidence === 'established' || brand.evidence === 'developing') return 'high'
  if (brand.evidence === 'limited') return 'medium'
  return 'low'
}

function planRecommendations(
  recommendations: CeoRecommendation[],
  dailyCapacityMinutes: number,
): CeoRecommendation[] {
  const plan: CeoRecommendation[] = []
  let minutes = 0

  for (const recommendation of recommendations) {
    if (plan.length >= 7) break
    const fits = minutes + recommendation.minutes <= dailyCapacityMinutes
    const mustInclude = recommendation.urgency === 'critical'
    if (fits || mustInclude) {
      plan.push(recommendation)
      minutes += recommendation.minutes
    }
  }

  return plan
}

export function calculateCeoRecommendations(
  items: InventoryItem[],
  orders: OrderRecord[],
  settings: JosSettings,
  now = new Date(),
  dailyCapacityMinutes = 120,
): CeoRecommendationReport {
  const inventory = calculateInventoryIntelligence(items, settings.finance, now)
  const brands = calculateBrandPerformance(
    items,
    settings.finance,
    {
      targetRoi: settings.targetRoi,
      minimumProfit: settings.minimumProfit,
    },
    now,
  )
  const finance = calculateFinanceSummary(settings.finance, items, now)
  const operations = calculateOperations(items, orders, now)
  const financeTransactions = settings.finance?.transactions.length ?? 0
  const waitingOrders = orders.filter(activeOrder)
  const waitingOrderSkus = new Set(waitingOrders.map(order => order.sku).filter(Boolean))
  const soldWithoutOrder = items.filter(
    item => item.status === 'Sold' && !waitingOrderSkus.has(item.sku),
  )

  const recommendations: CeoRecommendation[] = []

  // 1. Customer commitments always come first.
  const dispatchCount = waitingOrders.length + soldWithoutOrder.length
  if (dispatchCount > 0) {
    const orderRevenue = waitingOrders.reduce(
      (sum, order) => sum + Math.max(0, order.salePrice ?? 0),
      0,
    )
    const stockRevenue = soldWithoutOrder.reduce(
      (sum, item) => sum + Math.max(0, item.actualSalePrice ?? item.expectedSalePrice),
      0,
    )
    const protectedRevenue = orderRevenue + stockRevenue
    recommendations.push({
      id: 'dispatch-customer-commitments',
      title: `Dispatch ${dispatchCount} customer ${dispatchCount === 1 ? 'commitment' : 'commitments'} first`,
      detail: 'Complete paid or sold work before listing, pricing or sourcing activity.',
      reason: 'These records represent existing customer obligations and carry the highest service risk.',
      actionLabel: 'Open orders',
      destination: 'orders',
      category: 'customer',
      urgency: 'critical',
      confidence: 'high',
      confidenceReason: 'The recommendation is based directly on order and sold-stock statuses.',
      priority: 1000,
      minutes: Math.min(60, Math.max(10, dispatchCount * 9)),
      skus: unique([
        ...waitingOrders.map(order => order.sku).filter(Boolean),
        ...soldWithoutOrder.map(item => item.sku),
      ]),
      impact: protectedRevenue > 0 ? { protectedRevenue } : {},
      evidence: [
        `${waitingOrders.length} active order records`,
        `${soldWithoutOrder.length} sold inventory records without an active order`,
      ],
    })
  }

  // 2. Convert existing prepared work into live listings.
  const upload = topEntries(inventory.items, 'Upload', 6)
  if (upload.length > 0) {
    const forecastProfit = totalProfit(upload)
    recommendations.push({
      id: 'upload-ready-stock',
      title: `Upload ${upload.length} ready ${upload.length === 1 ? 'listing' : 'listings'}`,
      detail: `${money(forecastProfit)} forecast profit is closest to becoming live selling stock.`,
      reason: 'Ready-to-upload items require the least remaining work before they can produce customer demand.',
      actionLabel: 'Open listing pipeline',
      destination: 'pipeline',
      category: 'revenue',
      urgency: 'high',
      confidence: 'high',
      confidenceReason: 'Pipeline readiness is based on recorded photography and listing checklists.',
      priority: 920,
      minutes: Math.min(45, upload.length * 6),
      skus: entrySkus(upload),
      impact: { forecastProfit },
      evidence: upload.map(entry => `${entry.sku} readiness ${entry.readiness}/100`),
    })
  }

  const listing = topEntries(inventory.items, 'Write listing', 5)
  if (listing.length > 0) {
    const forecastProfit = totalProfit(listing)
    recommendations.push({
      id: 'finish-listing-copy',
      title: `Finish listing copy for ${listing.length} ${listing.length === 1 ? 'item' : 'items'}`,
      detail: `${money(forecastProfit)} forecast profit is waiting behind listing copy.`,
      reason: 'Photography is sufficiently advanced, making listing copy the current constraint.',
      actionLabel: 'Open listing pipeline',
      destination: 'pipeline',
      category: 'revenue',
      urgency: 'high',
      confidence: 'high',
      confidenceReason: 'The next step is inferred from recorded pipeline checklist completion.',
      priority: 850,
      minutes: Math.min(60, listing.length * 12),
      skus: entrySkus(listing),
      impact: { forecastProfit },
      evidence: listing.map(entry => `${entry.sku} listing action required`),
    })
  }

  const photography = topEntries(inventory.items, 'Photograph', 5)
  if (photography.length > 0) {
    const forecastProfit = totalProfit(photography)
    recommendations.push({
      id: 'complete-photography',
      title: `Complete photography for ${photography.length} ${photography.length === 1 ? 'item' : 'items'}`,
      detail: `${money(forecastProfit)} forecast profit remains blocked by photography work.`,
      reason: 'These items cannot move into listing copy until the photography evidence is complete.',
      actionLabel: 'Open photography queue',
      destination: 'pipeline',
      category: 'revenue',
      urgency: 'high',
      confidence: 'high',
      confidenceReason: 'The recommendation uses recorded photography checklist completion.',
      priority: 790,
      minutes: Math.min(60, photography.length * 10),
      skus: entrySkus(photography),
      impact: { forecastProfit },
      evidence: photography.map(entry => `${entry.sku} photography incomplete`),
    })
  }

  const preparation = topEntries(inventory.items, 'Prepare', 5)
  if (preparation.length > 0) {
    const forecastProfit = totalProfit(preparation)
    recommendations.push({
      id: 'prepare-sourced-stock',
      title: `Prepare ${preparation.length} sourced ${preparation.length === 1 ? 'item' : 'items'}`,
      detail: `${money(forecastProfit)} forecast profit has not yet entered photography.`,
      reason: 'Moving existing purchased stock forward should precede adding more cash to inventory.',
      actionLabel: 'Open operations',
      destination: 'operations',
      category: 'revenue',
      urgency: 'medium',
      confidence: 'high',
      confidenceReason: 'The records are in the Preparation pipeline stage.',
      priority: 710,
      minutes: Math.min(50, preparation.length * 10),
      skus: entrySkus(preparation),
      impact: { forecastProfit },
      evidence: preparation.map(entry => `${entry.sku} still in preparation`),
    })
  }

  // 3. Protect cash already tied up in stock.
  const ageing = inventory.items
    .filter(entry =>
      entry.item.status === 'Live' &&
      (
        entry.recommendedAction === 'Review price' ||
        entry.healthBand === 'attention' ||
        entry.healthBand === 'exit'
      ),
    )
    .sort((a, b) =>
      (b.ageDays ?? 0) - (a.ageDays ?? 0) ||
      b.cashLocked - a.cashLocked,
    )
    .slice(0, 10)

  if (ageing.length > 0) {
    const cashUnderReview = ageing.reduce((sum, entry) => sum + entry.cashLocked, 0)
    recommendations.push({
      id: 'review-ageing-stock',
      title: `Review pricing or exit route for ${ageing.length} ageing ${ageing.length === 1 ? 'item' : 'items'}`,
      detail: `${money(cashUnderReview)} of purchase cash should be reviewed for release—not assumed recovered.`,
      reason: 'Older live stock slows cash rotation and may need price, photography, bundle or exit action.',
      actionLabel: 'Open ageing stock',
      destination: 'inventory',
      status: 'Live',
      category: 'cash',
      urgency: ageing.some(entry => entry.healthBand === 'exit') ? 'high' : 'medium',
      confidence: ageing.every(entry => entry.ageDays !== undefined) ? 'high' : 'medium',
      confidenceReason: 'Cash exposure is recorded cost; release timing and final proceeds remain uncertain.',
      priority: ageing.some(entry => entry.healthBand === 'exit') ? 760 : 650,
      minutes: Math.min(45, Math.max(15, ageing.length * 4)),
      skus: entrySkus(ageing),
      impact: { cashUnderReview },
      evidence: ageing.map(entry =>
        `${entry.sku} · ${entry.ageDays ?? 'unknown'} days · ${entry.healthBand}`,
      ),
    })
  }

  const reduceBrands = brands.brands
    .filter(brand =>
      brand.recommendation === 'Reduce Buying' ||
      brand.recommendation === 'Exit Brand',
    )
    .sort((a, b) =>
      b.aged90Cost - a.aged90Cost ||
      a.cashEfficiencyScore - b.cashEfficiencyScore,
    )
    .slice(0, 3)

  for (const brand of reduceBrands) {
    recommendations.push({
      id: `brand-reduce-${brand.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: `${brand.recommendation}: ${brand.brand}`,
      detail: `${money(brand.activeCost)} active cash · ${money(brand.aged90Cost)} aged 90+ days.`,
      reason: brand.recommendationReason,
      actionLabel: 'Open brand evidence',
      destination: 'brand-performance',
      category: 'cash',
      urgency: brand.recommendation === 'Exit Brand' ? 'high' : 'medium',
      confidence: brandEvidenceConfidence(brand),
      confidenceReason: `${brand.completedSales} linked sales · ${brand.evidence} evidence.`,
      priority: brand.recommendation === 'Exit Brand' ? 735 : 625,
      minutes: 15,
      brand: brand.brand,
      impact: {},
      evidence: [
        `${brand.realisedRoi === undefined ? 'No realised ROI' : `${brand.realisedRoi.toFixed(0)}% realised ROI`}`,
        `${brand.averageDaysToSell === undefined ? 'Sell time unknown' : `${brand.averageDaysToSell.toFixed(0)} average days to sell`}`,
        `${brand.sellThroughRate.toFixed(0)}% sell-through`,
      ],
    })
  }

  // 4. Finance and record-quality controls.
  if (finance.additionalTaxReserveNeeded > 0) {
    recommendations.push({
      id: 'finance-tax-reserve',
      title: `Review a ${money(finance.additionalTaxReserveNeeded)} tax-reserve shortfall`,
      detail: 'The planning reserve is below the amount suggested by recorded operating profit and the current tax rate.',
      reason: 'Protecting tax cash reduces the risk of treating reserved money as sourcing cash.',
      actionLabel: 'Open Finance',
      destination: 'finance',
      category: 'finance',
      urgency: 'high',
      confidence: financeTransactions > 0 ? 'medium' : 'low',
      confidenceReason: 'This is a planning calculation, not an HMRC tax calculation.',
      priority: 820,
      minutes: 12,
      impact: {},
      evidence: [
        `${money(finance.taxReserveBalance)} recorded tax reserve`,
        `${money(finance.suggestedTaxReserve)} suggested planning reserve`,
      ],
    })
  }

  if (brands.dataQuality.unlinkedSales > 0) {
    recommendations.push({
      id: 'link-finance-sales',
      title: `Link ${brands.dataQuality.unlinkedSales} finance ${brands.dataQuality.unlinkedSales === 1 ? 'sale' : 'sales'} to inventory SKUs`,
      detail: 'Unlinked sales are excluded from brand ROI and selling-speed evidence.',
      reason: 'Linking completed sales improves brand decisions and prevents forecast-only conclusions.',
      actionLabel: 'Open Finance',
      destination: 'finance',
      category: 'quality',
      urgency: 'medium',
      confidence: 'high',
      confidenceReason: 'The gap is measured directly from finance transactions without valid inventory links.',
      priority: 610,
      minutes: Math.min(30, brands.dataQuality.unlinkedSales * 4),
      impact: {},
      evidence: [`${brands.dataQuality.unlinkedSales} unlinked finance sales`],
    })
  }

  if (inventory.storage.missing > 0) {
    recommendations.push({
      id: 'assign-storage',
      title: `Assign storage to ${inventory.storage.missing} ${inventory.storage.missing === 1 ? 'item' : 'items'}`,
      detail: 'Missing locations increase picking time and dispatch-error risk.',
      reason: 'Accurate storage is an operational control rather than optional record detail.',
      actionLabel: 'Open inventory records',
      destination: 'inventory',
      category: 'quality',
      urgency: 'medium',
      confidence: 'high',
      confidenceReason: 'The count comes directly from blank or TBC storage fields.',
      priority: 570,
      minutes: Math.min(35, inventory.storage.missing * 3),
      impact: {},
      evidence: [`${inventory.storage.missing} active stock records missing storage`],
    })
  }

  if (inventory.dataQuality.missingMeasurements > 0) {
    recommendations.push({
      id: 'add-measurements',
      title: `Add measurements to ${inventory.dataQuality.missingMeasurements} ${inventory.dataQuality.missingMeasurements === 1 ? 'item' : 'items'}`,
      detail: 'Missing measurements weaken listing quality and buyer confidence.',
      reason: 'Complete listing evidence reduces avoidable buyer questions and sizing uncertainty.',
      actionLabel: 'Open listing pipeline',
      destination: 'pipeline',
      category: 'quality',
      urgency: 'medium',
      confidence: 'high',
      confidenceReason: 'The count comes directly from photo and listing checklists.',
      priority: 550,
      minutes: Math.min(40, inventory.dataQuality.missingMeasurements * 4),
      impact: {},
      evidence: [`${inventory.dataQuality.missingMeasurements} records missing measurements`],
    })
  }

  if (inventory.duplicateCandidates.length > 0) {
    recommendations.push({
      id: 'review-similar-records',
      title: `Review ${inventory.duplicateCandidates.length} similar-stock ${inventory.duplicateCandidates.length === 1 ? 'warning' : 'warnings'}`,
      detail: 'JOS found records with matching or highly similar stock details.',
      reason: 'Review prevents accidental duplicate listings or incorrect stock counts.',
      actionLabel: 'Open Inventory Intelligence',
      destination: 'inventory-intelligence',
      category: 'risk',
      urgency: 'medium',
      confidence: 'medium',
      confidenceReason: 'Similarity is a review warning and is not proof of duplication.',
      priority: 520,
      minutes: Math.min(30, inventory.duplicateCandidates.length * 5),
      impact: {},
      evidence: inventory.duplicateCandidates
        .slice(0, 5)
        .map(candidate => `${candidate.leftSku} ↔ ${candidate.rightSku} · ${candidate.confidence}`),
    })
  }

  if (
    financeTransactions === 0 &&
    finance.cashBalance === 0 &&
    finance.availableSourcingBudget === 0
  ) {
    recommendations.push({
      id: 'set-finance-starting-position',
      title: 'Set the Finance starting position before sourcing',
      detail: 'Opening cash, reserves and transactions are currently insufficient to support a safe buying limit.',
      reason: 'JOS should not recommend spending money that has not been recorded.',
      actionLabel: 'Open Finance',
      destination: 'finance',
      category: 'finance',
      urgency: 'high',
      confidence: 'high',
      confidenceReason: 'The Finance ledger and opening balance are both empty.',
      priority: 700,
      minutes: 15,
      impact: {},
      evidence: ['No finance transactions', 'No recorded available sourcing cash'],
    })
  }

  // 5. Sourcing comes last and is blocked by unfinished commitments.
  const operationalBacklog =
    dispatchCount +
    operations.pipelineWaiting +
    inventory.dataQuality.missingMeasurements

  const buyMoreBrands = brands.brands
    .filter(brand => brand.recommendation === 'Buy More')
    .sort((a, b) => b.cashEfficiencyScore - a.cashEfficiencyScore)

  let sourcingDecision: SourcingDecision
  let sourcingHeadline: string
  let sourcingReason: string

  if (dispatchCount > 0 || operations.pipelineWaiting > 0) {
    sourcingDecision = 'blocked'
    sourcingHeadline = 'Do not add new stock yet'
    sourcingReason = `${dispatchCount} customer commitments and ${operations.pipelineWaiting} pipeline items should move before more cash is tied up.`
    recommendations.push({
      id: 'hold-sourcing-for-backlog',
      title: 'Hold new sourcing until existing work moves',
      detail: sourcingReason,
      reason: 'Buying more stock would increase cash tied up while customer or listing work is still waiting.',
      actionLabel: 'Open Operations',
      destination: 'operations',
      category: 'sourcing',
      urgency: 'medium',
      confidence: 'high',
      confidenceReason: 'The hold is based on recorded dispatch and pipeline backlog.',
      priority: 500,
      minutes: 5,
      impact: {},
      evidence: [
        `${dispatchCount} dispatch commitments`,
        `${operations.pipelineWaiting} pipeline items waiting`,
      ],
    })
  } else if (finance.availableSourcingBudget <= 0) {
    sourcingDecision = 'hold'
    sourcingHeadline = 'No safe sourcing cash is recorded'
    sourcingReason = 'Finance does not currently show cash available after the emergency reserve and planned sourcing limit.'
    recommendations.push({
      id: 'hold-sourcing-for-cash',
      title: 'Hold sourcing until Finance shows safe cash',
      detail: sourcingReason,
      reason: 'A buying recommendation should not exceed recorded cash controls.',
      actionLabel: 'Open Finance',
      destination: 'finance',
      category: 'sourcing',
      urgency: 'medium',
      confidence: 'high',
      confidenceReason: 'The safe limit comes directly from the Finance calculation.',
      priority: 490,
      minutes: 8,
      impact: { safeSpendLimit: 0 },
      evidence: [`${money(finance.availableSourcingBudget)} available sourcing budget`],
    })
  } else if (buyMoreBrands.length === 0) {
    sourcingDecision = 'hold'
    sourcingHeadline = 'Source only through SourceCheck'
    sourcingReason = 'Cash exists, but no brand has enough linked evidence to justify a Buy More recommendation.'
    recommendations.push({
      id: 'sourcecheck-only',
      title: `Keep sourcing selective within a ${money(finance.availableSourcingBudget)} maximum`,
      detail: sourcingReason,
      reason: 'Available cash alone does not prove that a brand or item is a good purchase.',
      actionLabel: 'Open SourceCheck',
      destination: 'sourcecheck',
      category: 'sourcing',
      urgency: 'opportunity',
      confidence: 'medium',
      confidenceReason: 'The cash limit is recorded, but brand evidence has not produced a Buy More result.',
      priority: 340,
      minutes: 10,
      impact: { safeSpendLimit: finance.availableSourcingBudget },
      evidence: [
        `${money(finance.availableSourcingBudget)} maximum recorded sourcing budget`,
        'No evidence-qualified Buy More brands',
      ],
    })
  } else {
    const brand = buyMoreBrands[0]
    sourcingDecision = 'selective'
    sourcingHeadline = `Selective sourcing opportunity: ${brand.brand}`
    sourcingReason = `${brand.brand} meets the current linked-sales, return, speed and cash-efficiency rules.`
    recommendations.push({
      id: `source-${brand.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: `Source ${brand.brand} selectively`,
      detail: `Use SourceCheck and remain within the ${money(finance.availableSourcingBudget)} recorded maximum.`,
      reason: sourcingReason,
      actionLabel: 'Open SourceCheck',
      destination: 'sourcecheck',
      category: 'sourcing',
      urgency: 'opportunity',
      confidence: brandEvidenceConfidence(brand),
      confidenceReason: `${brand.completedSales} linked sales · ${brand.evidence} evidence · ${brand.cashEfficiencyScore}/100 efficiency.`,
      priority: 360,
      minutes: 10,
      brand: brand.brand,
      impact: { safeSpendLimit: finance.availableSourcingBudget },
      evidence: [
        `${brand.realisedRoi?.toFixed(0) ?? 'Unknown'}% realised ROI`,
        `${brand.averageRealisedProfit === undefined ? 'Unknown' : money(brand.averageRealisedProfit)} average realised profit`,
        `${brand.averageDaysToSell === undefined ? 'Unknown' : `${brand.averageDaysToSell.toFixed(0)} days`} average sell time`,
      ],
    })
  }

  const urgencyWeight: Record<CeoRecommendationUrgency, number> = {
    critical: 400,
    high: 250,
    medium: 120,
    opportunity: 0,
  }

  const sorted = recommendations.sort(
    (a, b) =>
      (b.priority + urgencyWeight[b.urgency]) -
      (a.priority + urgencyWeight[a.urgency]),
  )

  const todayPlan = planRecommendations(sorted, dailyCapacityMinutes)
  const selectedIds = new Set(todayPlan.map(recommendation => recommendation.id))
  const deferred = sorted.filter(recommendation => !selectedIds.has(recommendation.id))
  const confidence = confidenceFromData(
    inventory.dataQuality.score,
    brands.dataQuality.linkedSales,
    brands.brandsWithRealisedSales,
    financeTransactions,
  )

  return {
    generatedAt: now.toISOString(),
    allRecommendations: sorted,
    todayPlan,
    deferred,
    planMinutes: todayPlan.reduce((sum, recommendation) => sum + recommendation.minutes, 0),
    dailyCapacityMinutes,
    protectedRevenue: todayPlan.reduce(
      (sum, recommendation) => sum + (recommendation.impact.protectedRevenue ?? 0),
      0,
    ),
    forecastProfitUnlocked: todayPlan.reduce(
      (sum, recommendation) => sum + (recommendation.impact.forecastProfit ?? 0),
      0,
    ),
    cashUnderReview: todayPlan.reduce(
      (sum, recommendation) => sum + (recommendation.impact.cashUnderReview ?? 0),
      0,
    ),
    safeSourcingLimit: finance.availableSourcingBudget,
    sourcingDecision,
    sourcingHeadline,
    sourcingReason,
    decisionConfidence: confidence.confidence,
    decisionConfidenceScore: confidence.score,
    decisionConfidenceReason: confidence.reason,
    operationalBacklog,
    evidence: {
      inventoryDataQuality: inventory.dataQuality.score,
      inventoryHealth: inventory.healthScore,
      linkedSales: brands.dataQuality.linkedSales,
      unlinkedSales: brands.dataQuality.unlinkedSales,
      brandsWithRealisedSales: brands.brandsWithRealisedSales,
      financeTransactions,
      waitingOrders: dispatchCount,
      pipelineWaiting: operations.pipelineWaiting,
    },
    rules: [
      'Customer commitments outrank listing, stock-review and sourcing work.',
      'Existing purchased stock should move towards sale before more cash is tied up.',
      'Cash under review is recorded purchase cost, not guaranteed cash release.',
      'Forecast profit is not realised profit and is shown separately.',
      'Buy More needs linked sales evidence; forecast-only brands cannot trigger it.',
      'The sourcing limit is a maximum supported by Finance records, not a spending target.',
      'Recommendations never edit stock, finance, order or grading records automatically.',
    ],
  }
}
