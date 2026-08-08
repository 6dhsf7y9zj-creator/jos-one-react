import type { FinanceState, InventoryItem, OrderRecord, StockStatus } from '../types/inventory.ts'

export type RevenueStage =
  | 'Preparation'
  | 'Photography'
  | 'Listing work'
  | 'Ready to list'
  | 'Live'
  | 'Sold / payment'
  | 'Dispatch'
  | 'Completed'

export interface RevenueOpportunity {
  sku: string
  brand: string
  description: string
  stage: RevenueStage
  expectedRevenue: number
  expectedProfit: number
  daysWaiting: number
  score: number
  action: string
}

export interface RevenueStageSummary {
  stage: RevenueStage
  items: number
  revenue: number
  profit: number
  averageDays: number
}

export interface RevenueIntelligenceReport {
  expectedRevenue: number
  expectedProfit: number
  blockedRevenue: number
  blockedProfit: number
  realisedRevenue: number
  cashWaiting: number
  opportunityScore: number
  stages: RevenueStageSummary[]
  opportunities: RevenueOpportunity[]
  warnings: string[]
  highestValueAction?: RevenueOpportunity
}

const completedOrderStatuses = new Set(['Delivered', 'Returned', 'Refunded', 'Cancelled'])
const dispatchOrderStatuses = new Set(['Paid', 'Ready to pack', 'Packed'])

function itemCost(item: InventoryItem): number {
  return Math.max(0, item.landedCost ?? item.purchasePrice ?? 0)
}

function itemRevenue(item: InventoryItem): number {
  return Math.max(0, item.actualSalePrice ?? item.listPrice ?? item.expectedSalePrice ?? 0)
}

function daysSince(value?: string): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return 0
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000))
}

function inferStage(item: InventoryItem, order?: OrderRecord): RevenueStage {
  if (order && completedOrderStatuses.has(order.status)) return 'Completed'
  if (order && (order.status === 'Dispatched' || dispatchOrderStatuses.has(order.status))) return 'Dispatch'
  if (item.status === 'Sold') return 'Sold / payment'
  if (item.status === 'Dispatched' || item.status === 'Archived') return 'Completed'
  if (item.status === 'Live' || item.pipelineStage === 'Live') return 'Live'
  if (item.pipelineStage === 'Ready to Upload') return 'Ready to list'
  if (item.status === 'Photographed' || item.pipelineStage === 'Listing Copy' || item.pipelineStage === 'Photo Review') return 'Listing work'
  if (item.pipelineStage === 'Photography') return 'Photography'
  return 'Preparation'
}

function actionFor(stage: RevenueStage): string {
  switch (stage) {
    case 'Preparation': return 'Prepare item and assign storage'
    case 'Photography': return 'Complete photography'
    case 'Listing work': return 'Finish listing copy and pricing'
    case 'Ready to list': return 'Publish listing now'
    case 'Live': return 'Review price, favourites and offers'
    case 'Sold / payment': return 'Confirm payment and create order'
    case 'Dispatch': return 'Pack and dispatch customer order'
    case 'Completed': return 'No action required'
  }
}

function scoreOpportunity(item: InventoryItem, stage: RevenueStage, profit: number, days: number): number {
  const roi = itemCost(item) > 0 ? (profit / itemCost(item)) * 100 : 0
  const profitScore = Math.min(40, Math.max(0, profit) * 1.6)
  const roiScore = Math.min(25, Math.max(0, roi) / 8)
  const ageScore = Math.min(20, days / 3)
  const stageScore: Record<RevenueStage, number> = {
    Preparation: 4,
    Photography: 7,
    'Listing work': 10,
    'Ready to list': 15,
    Live: 8,
    'Sold / payment': 13,
    Dispatch: 15,
    Completed: 0,
  }
  return Math.max(0, Math.min(100, Math.round(profitScore + roiScore + ageScore + stageScore[stage])))
}

export function calculateRevenueIntelligence(
  items: InventoryItem[],
  orders: OrderRecord[],
  finance?: FinanceState,
): RevenueIntelligenceReport {
  const orderBySku = new Map(orders.map(order => [order.sku, order]))
  const stageOrder: RevenueStage[] = ['Preparation', 'Photography', 'Listing work', 'Ready to list', 'Live', 'Sold / payment', 'Dispatch', 'Completed']

  const opportunities = items.map(item => {
    const stage = inferStage(item, orderBySku.get(item.sku))
    const expectedRevenue = itemRevenue(item)
    const expectedProfit = Math.max(0, expectedRevenue - itemCost(item))
    const daysWaiting = Math.max(item.daysInStock ?? 0, daysSince(item.dateSourced))
    return {
      sku: item.sku,
      brand: item.brand,
      description: item.description,
      stage,
      expectedRevenue,
      expectedProfit,
      daysWaiting,
      score: scoreOpportunity(item, stage, expectedProfit, daysWaiting),
      action: actionFor(stage),
    }
  }).sort((a, b) => b.score - a.score || b.expectedProfit - a.expectedProfit)

  const stages = stageOrder.map(stage => {
    const records = opportunities.filter(item => item.stage === stage)
    return {
      stage,
      items: records.length,
      revenue: records.reduce((sum, item) => sum + item.expectedRevenue, 0),
      profit: records.reduce((sum, item) => sum + item.expectedProfit, 0),
      averageDays: records.length ? Math.round(records.reduce((sum, item) => sum + item.daysWaiting, 0) / records.length) : 0,
    }
  })

  const active = opportunities.filter(item => item.stage !== 'Completed')
  const blocked = opportunities.filter(item => ['Preparation', 'Photography', 'Listing work', 'Ready to list'].includes(item.stage))
  const realisedRevenue = (finance?.transactions ?? [])
    .filter(transaction => transaction.type === 'sale')
    .reduce((sum, transaction) => sum + Math.max(0, transaction.amount), 0)
  const cashWaiting = opportunities
    .filter(item => item.stage === 'Sold / payment' || item.stage === 'Dispatch')
    .reduce((sum, item) => sum + item.expectedRevenue, 0)

  const warnings: string[] = []
  const preparation = stages.find(stage => stage.stage === 'Preparation')?.items ?? 0
  const photography = stages.find(stage => stage.stage === 'Photography')?.items ?? 0
  const dispatch = stages.find(stage => stage.stage === 'Dispatch')?.items ?? 0
  const agedLive = opportunities.filter(item => item.stage === 'Live' && item.daysWaiting >= 60).length
  if (preparation > 0) warnings.push(`${preparation} items are still waiting for preparation or storage.`)
  if (photography > 0) warnings.push(`${photography} items are waiting for photography.`)
  if (dispatch > 0) warnings.push(`${dispatch} customer orders need dispatch attention.`)
  if (agedLive > 0) warnings.push(`${agedLive} live items have been waiting 60+ days.`)
  if (blocked.length > 10) warnings.push('The pre-listing backlog is high; pause sourcing until it falls.')

  const averageOpportunity = active.length ? Math.round(active.reduce((sum, item) => sum + item.score, 0) / active.length) : 100

  return {
    expectedRevenue: active.reduce((sum, item) => sum + item.expectedRevenue, 0),
    expectedProfit: active.reduce((sum, item) => sum + item.expectedProfit, 0),
    blockedRevenue: blocked.reduce((sum, item) => sum + item.expectedRevenue, 0),
    blockedProfit: blocked.reduce((sum, item) => sum + item.expectedProfit, 0),
    realisedRevenue,
    cashWaiting,
    opportunityScore: averageOpportunity,
    stages,
    opportunities,
    warnings,
    highestValueAction: active[0],
  }
}

export function stageToInventoryStatus(stage: RevenueStage): StockStatus | undefined {
  if (stage === 'Photography' || stage === 'Listing work' || stage === 'Ready to list') return 'Photographed'
  if (stage === 'Live') return 'Live'
  if (stage === 'Sold / payment') return 'Sold'
  if (stage === 'Dispatch' || stage === 'Completed') return 'Dispatched'
  return 'Prep'
}
