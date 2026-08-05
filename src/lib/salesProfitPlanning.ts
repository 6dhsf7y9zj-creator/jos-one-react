import type { InventoryItem, JosSettings, OrderRecord, SalesPlanningSettings } from '../types/inventory'
import { calculateFinanceSummary, normaliseFinanceState } from './finance'
import { calculateInventoryIntelligence } from './inventoryIntelligence'
import { calculateLaunchCommandReport } from './launchCommand'
import { inferPipelineStage } from './pipeline'

export type PlanningConfidence = 'low' | 'medium' | 'high'
export type TargetLevel = 'Bronze' | 'Silver' | 'Gold' | 'Platinum'

export type PlanningAction = {
  id: string
  title: string
  detail: string
  quantity: number
  destination: 'orders' | 'pipeline' | 'inventory' | 'sourcecheck' | 'finance'
  priority: number
}

export type SalesProfitPlan = {
  generatedAt: string
  targetLevel: TargetLevel
  monthlyTarget: number
  realisedProfit: number
  targetRemaining: number
  targetProgress: number
  daysElapsed: number
  daysRemaining: number
  paceForecastProfit: number
  paceGap: number
  averageRealisedProfit?: number
  averageRealisedSalePrice?: number
  planningAverageProfit: number
  planningAverageSalePrice: number
  realisedSales: number
  salesRequired: number
  revenueRequired: number
  weeklyProfitRequired: number
  dailyProfitRequired: number
  weeklySalesRequired: number
  dailySalesRequired: number
  sellThroughRate: number
  stockRequired: number
  launchEligibleStock: number
  additionalStockRequired: number
  liveListings: number
  readyListings: number
  additionalListingsRequired: number
  safeSourcingCash: number
  estimatedSourcingCost: number
  sourcingFundingGap: number
  targetLadder: Array<{ level: TargetLevel; target: number; progress: number; achieved: boolean }>
  actions: PlanningAction[]
  health: {
    financial: number
    inventory: number
    operations: number
    growth: number
    overall: number
  }
  simulator: {
    projectedMonthlyProfit: number
    projectedSales: number
    projectedRevenue: number
    projectedStockNeeded: number
    projectedAdditionalStock: number
  }
  confidence: PlanningConfidence
  confidenceScore: number
  confidenceReason: string
  evidence: {
    linkedSalesThisMonth: number
    financeTransactions: number
    inventoryDataQuality: number
    liveListings: number
    readyListings: number
  }
  assumptions: string[]
}

export const defaultSalesPlanningSettings: SalesPlanningSettings = {
  bronzeTarget: 2000,
  silverTarget: 3500,
  goldTarget: 5000,
  platinumTarget: 7500,
  assumedAverageProfit: 25,
  assumedSellThroughRate: 65,
  assumedListingsPerWeek: 10,
}

function clamp(value: number): number { return Math.max(0, Math.min(100, Math.round(value))) }
function finite(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}
export function normaliseSalesPlanningSettings(input: unknown): SalesPlanningSettings {
  if (!input || typeof input !== 'object') return { ...defaultSalesPlanningSettings }
  const raw = input as Record<string, unknown>
  return {
    bronzeTarget: Math.max(0, finite(raw.bronzeTarget, 2000)),
    silverTarget: Math.max(0, finite(raw.silverTarget, 3500)),
    goldTarget: Math.max(0, finite(raw.goldTarget, 5000)),
    platinumTarget: Math.max(0, finite(raw.platinumTarget, 7500)),
    assumedAverageProfit: Math.max(1, finite(raw.assumedAverageProfit, 25)),
    assumedSellThroughRate: Math.max(1, Math.min(100, finite(raw.assumedSellThroughRate, 65))),
    assumedListingsPerWeek: Math.max(1, finite(raw.assumedListingsPerWeek, 10)),
  }
}

function currentMonth(date: string, now: Date): boolean {
  const parsed = new Date(`${date}T12:00:00`)
  return parsed.getFullYear() === now.getFullYear() && parsed.getMonth() === now.getMonth()
}
function monthPosition(now: Date) {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return { daysElapsed: now.getDate(), daysRemaining: Math.max(0, daysInMonth - now.getDate()), daysInMonth }
}
function targetLevel(target: number, settings: SalesPlanningSettings): TargetLevel {
  if (target <= settings.bronzeTarget) return 'Bronze'
  if (target <= settings.silverTarget) return 'Silver'
  if (target <= settings.goldTarget) return 'Gold'
  return 'Platinum'
}

export function calculateSalesProfitPlan(
  items: InventoryItem[],
  orders: OrderRecord[],
  settings: JosSettings,
  overrides: Partial<SalesPlanningSettings> = {},
  now = new Date(),
): SalesProfitPlan {
  const planning = { ...normaliseSalesPlanningSettings(settings.salesPlanning), ...overrides }
  const monthlyTarget = Math.max(0, settings.monthlyProfitTarget ?? planning.goldTarget)
  const financeState = normaliseFinanceState(settings.finance)
  const finance = calculateFinanceSummary(financeState, items, now)
  const inventory = calculateInventoryIntelligence(items, settings.finance, now)
  const launch = calculateLaunchCommandReport(items, orders, settings, now)
  const itemsBySku = new Map(items.map(item => [item.sku, item]))
  const monthSales = financeState.transactions.filter(t => t.type === 'sale' && currentMonth(t.date, now))
  const linked = monthSales.filter(t => Boolean(t.sku && itemsBySku.has(t.sku)))
  const realisedProfitValues = linked.map(t => Math.max(0, t.amount) - (itemsBySku.get(t.sku!)?.purchasePrice ?? 0))
  const averageRealisedProfit = realisedProfitValues.length ? realisedProfitValues.reduce((a,b)=>a+b,0)/realisedProfitValues.length : undefined
  const averageRealisedSalePrice = monthSales.length ? monthSales.reduce((a,b)=>a+Math.max(0,b.amount),0)/monthSales.length : undefined
  const planningAverageProfit = Math.max(1, averageRealisedProfit ?? planning.assumedAverageProfit)
  const averageCost = launch.stock.eligibleItems ? items.filter(i => !['Sold','Dispatched','Archived'].includes(i.status) && i.grade !== 'Exit').reduce((a,i)=>a+i.purchasePrice,0)/launch.stock.eligibleItems : 0
  const planningAverageSalePrice = Math.max(planningAverageProfit, averageRealisedSalePrice ?? planningAverageProfit + averageCost)
  const realisedProfit = finance.monthOperatingProfit
  const targetRemaining = Math.max(0, monthlyTarget - realisedProfit)
  const targetProgress = monthlyTarget > 0 ? clamp(realisedProfit/monthlyTarget*100) : 100
  const position = monthPosition(now)
  const paceForecastProfit = position.daysElapsed > 0 ? realisedProfit / position.daysElapsed * position.daysInMonth : 0
  const paceGap = Math.max(0, monthlyTarget - paceForecastProfit)
  const salesRequired = Math.ceil(targetRemaining / planningAverageProfit)
  const revenueRequired = salesRequired * planningAverageSalePrice
  const weeksRemaining = Math.max(1/7, position.daysRemaining/7)
  const weeklyProfitRequired = targetRemaining / weeksRemaining
  const dailyProfitRequired = position.daysRemaining > 0 ? targetRemaining/position.daysRemaining : targetRemaining
  const weeklySalesRequired = salesRequired / weeksRemaining
  const dailySalesRequired = position.daysRemaining > 0 ? salesRequired/position.daysRemaining : salesRequired
  const sellThroughRate = Math.max(1, Math.min(100, planning.assumedSellThroughRate))
  const stockRequired = Math.ceil(salesRequired / (sellThroughRate/100))
  const launchEligibleStock = launch.stock.eligibleItems
  const additionalStockRequired = Math.max(0, stockRequired - launchEligibleStock)
  const active = items.filter(i => !['Sold','Dispatched','Archived'].includes(i.status) && i.grade !== 'Exit')
  const readyListings = active.filter(i => ['Ready to Upload','Live'].includes(inferPipelineStage(i))).length
  const liveListings = active.filter(i => i.status === 'Live').length
  const additionalListingsRequired = Math.max(0, stockRequired - readyListings)
  const estimatedSourcingCost = additionalStockRequired * averageCost
  const safeSourcingCash = finance.availableSourcingBudget
  const sourcingFundingGap = Math.max(0, estimatedSourcingCost - safeSourcingCash)

  const waitingOrders = orders.filter(o => !/dispatched|delivered|completed|archived|cancelled|refunded|returned/i.test(o.status)).length
  const prep = active.filter(i => inferPipelineStage(i) === 'Preparation').length
  const photography = active.filter(i => ['Photography','Photo Review'].includes(inferPipelineStage(i))).length
  const listingCopy = active.filter(i => inferPipelineStage(i) === 'Listing Copy').length
  const actions: PlanningAction[] = []
  if (waitingOrders) actions.push({ id:'dispatch', title:`Dispatch ${waitingOrders} customer commitment${waitingOrders===1?'':'s'}`, detail:'Paid or sold work comes before growth activity.', quantity:waitingOrders, destination:'orders', priority:100 })
  if (additionalListingsRequired) actions.push({ id:'list', title:`Create ${additionalListingsRequired} additional launch-ready listings`, detail:`The current plan needs approximately ${stockRequired} available items at ${sellThroughRate.toFixed(0)}% sell-through.`, quantity:additionalListingsRequired, destination:'pipeline', priority:90 })
  if (listingCopy) actions.push({ id:'copy', title:`Finish listing copy for ${listingCopy} item${listingCopy===1?'':'s'}`, detail:'These items are closest to becoming ready listings.', quantity:listingCopy, destination:'pipeline', priority:85 })
  if (photography) actions.push({ id:'photos', title:`Complete photography for ${photography} item${photography===1?'':'s'}`, detail:'Photography is currently blocking listing output.', quantity:photography, destination:'pipeline', priority:80 })
  if (prep) actions.push({ id:'prep', title:`Prepare ${prep} sourced item${prep===1?'':'s'}`, detail:'Move already-purchased stock before adding more cash to inventory.', quantity:prep, destination:'inventory', priority:75 })
  if (additionalStockRequired) actions.push({ id:'source', title:`Plan up to ${additionalStockRequired} additional stock purchases`, detail:`Estimated cost ${estimatedSourcingCost.toFixed(2)}; use SourceCheck and stay within safe cash.`, quantity:additionalStockRequired, destination:safeSourcingCash>0?'sourcecheck':'finance', priority:60 })
  actions.sort((a,b)=>b.priority-a.priority)

  const simulatorSales = Math.floor((readyListings + planning.assumedListingsPerWeek * weeksRemaining) * (sellThroughRate/100))
  const simulatorProfit = realisedProfit + simulatorSales * planningAverageProfit
  const simulatorRevenue = simulatorSales * planningAverageSalePrice
  const simulatorStockNeeded = Math.ceil(Math.max(0, monthlyTarget-realisedProfit)/planningAverageProfit/(sellThroughRate/100))

  const financial = clamp((targetProgress*.55) + (paceForecastProfit >= monthlyTarget ? 30 : Math.max(0, paceForecastProfit/monthlyTarget*30)) + (safeSourcingCash>0?15:0))
  const operations = clamp((readyListings/Math.max(1, stockRequired)*60) + (waitingOrders===0?20:0) + Math.min(20, planning.assumedListingsPerWeek/10*20))
  const growth = clamp(launch.overallReadiness*.6 + launch.brands.progress*.25 + (additionalStockRequired===0?15:0))
  const health = { financial, inventory: inventory.healthScore, operations, growth, overall: clamp((financial+inventory.healthScore+operations+growth)/4) }

  const evidenceCount = linked.length
  const confidenceScore = clamp(inventory.dataQuality.score*.35 + Math.min(100,evidenceCount*20)*.4 + Math.min(100,financeState.transactions.length*8)*.25)
  const confidence: PlanningConfidence = confidenceScore>=75?'high':confidenceScore>=50?'medium':'low'
  const confidenceReason = confidence==='high' ? 'The plan is supported by linked monthly sales, finance records and complete inventory data.' : confidence==='medium' ? 'The plan is usable, but some sales-volume or average-profit assumptions still need more evidence.' : 'The plan relies heavily on explicit assumptions because realised linked sales evidence is limited.'
  const ladder: Array<[TargetLevel,number]> = [['Bronze',planning.bronzeTarget],['Silver',planning.silverTarget],['Gold',planning.goldTarget],['Platinum',planning.platinumTarget]]

  return {
    generatedAt: now.toISOString(), targetLevel: targetLevel(monthlyTarget,planning), monthlyTarget, realisedProfit, targetRemaining, targetProgress,
    daysElapsed:position.daysElapsed, daysRemaining:position.daysRemaining, paceForecastProfit, paceGap, averageRealisedProfit, averageRealisedSalePrice,
    planningAverageProfit, planningAverageSalePrice, realisedSales:monthSales.length, salesRequired, revenueRequired, weeklyProfitRequired, dailyProfitRequired,
    weeklySalesRequired, dailySalesRequired, sellThroughRate, stockRequired, launchEligibleStock, additionalStockRequired, liveListings, readyListings,
    additionalListingsRequired, safeSourcingCash, estimatedSourcingCost, sourcingFundingGap,
    targetLadder: ladder.map(([level,target])=>({level,target,progress:target>0?clamp(realisedProfit/target*100):100,achieved:realisedProfit>=target})),
    actions, health,
    simulator:{ projectedMonthlyProfit:simulatorProfit, projectedSales:simulatorSales, projectedRevenue:simulatorRevenue, projectedStockNeeded:simulatorStockNeeded, projectedAdditionalStock:Math.max(0,simulatorStockNeeded-launchEligibleStock) },
    confidence, confidenceScore, confidenceReason,
    evidence:{ linkedSalesThisMonth:linked.length, financeTransactions:financeState.transactions.length, inventoryDataQuality:inventory.dataQuality.score, liveListings, readyListings },
    assumptions:[
      'Required sales divide the remaining operating-profit target by the planning average profit per sale.',
      'Linked month-to-date sales set the average profit when available; otherwise the saved planning assumption is used.',
      'Stock required adjusts required sales by the assumed sell-through rate.',
      'Additional listings compare required stock capacity with items already Ready to Upload or Live.',
      'Estimated sourcing cost uses the current average purchase cost of launch-eligible stock.',
      'The simulator is a what-if planning model and does not replace the Business Forecasting cash scenarios.',
      'Targets and health scores are decision support, not guarantees of sales or profit.',
    ],
  }
}
