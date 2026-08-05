import type {
  FinanceState,
  InventoryItem,
  JosSettings,
  OrderRecord,
} from '../types/inventory.ts'
import { calculateBrandPerformance } from './brandPerformance.ts'
import { calculateFinanceSummary, normaliseFinanceState } from './finance.ts'
import { calculateInventoryIntelligence } from './inventoryIntelligence.ts'
import { inferPipelineStage } from './pipeline.ts'

export type ForecastScenario = 'conservative' | 'base' | 'optimistic'
export type ForecastConfidence = 'low' | 'medium' | 'high'

export type ForecastOptions = {
  scenario: ForecastScenario
  horizonWeeks: number
  monthlyProfitTarget: number
}

export type ForecastWeek = {
  week: number
  startDate: string
  endDate: string
  openingCash: number
  projectedSales: number
  projectedCostOfGoods: number
  projectedExpenses: number
  projectedTaxReserve: number
  projectedOperatingProfit: number
  projectedItemsSold: number
  closingCash: number
  safeSourcingCapacity: number
}

export type ForecastScenarioSummary = {
  scenario: ForecastScenario
  projectedSales: number
  projectedOperatingProfit: number
  projectedEndCash: number
  lowestCashPoint: number
  projectedItemsSold: number
  rolling30DayProfit: number
  monthlyTargetGap: number
  targetProgress: number
  safeSourcingCapacity: number
}

export type ForecastCandidate = {
  sku: string
  brand: string
  source: 'order' | 'sold-stock' | 'inventory'
  scheduledWeek: number
  probability: number
  projectedRevenue: number
  projectedCost: number
}

export type BusinessForecastReport = {
  generatedAt: string
  scenario: ForecastScenario
  horizonWeeks: number
  monthlyProfitTarget: number
  weeks: ForecastWeek[]
  candidates: ForecastCandidate[]
  summary: ForecastScenarioSummary
  scenarioComparison: Record<ForecastScenario, ForecastScenarioSummary>
  currentCash: number
  currentMonthRealisedProfit: number
  currentTaxReserveBalance: number
  currentTaxReserveShortfall: number
  emergencyReserve: number
  plannedSourcingCap: number
  historicalWeeklySales: number
  historicalWeeklyExpenses: number
  confidence: ForecastConfidence
  confidenceScore: number
  confidenceReason: string
  evidence: {
    linkedSales: number
    unlinkedSales: number
    salesLast90Days: number
    expensesLast90Days: number
    activeItems: number
    itemsWithDates: number
    inventoryDataQuality: number
  }
  assumptions: string[]
  warnings: string[]
}

type ScenarioRules = {
  priceFactor: number
  expenseFactor: number
  probability: Record<
    'order' | 'sold-stock' | 'live' | 'ready' | 'listing' | 'photography' | 'preparation',
    number
  >
  week: Record<
    'order' | 'sold-stock' | 'live' | 'ready' | 'listing' | 'photography' | 'preparation',
    number
  >
}

const scenarioRules: Record<ForecastScenario, ScenarioRules> = {
  conservative: {
    priceFactor: .84,
    expenseFactor: 1.15,
    probability: {
      order: 1,
      'sold-stock': 1,
      live: .35,
      ready: .26,
      listing: .20,
      photography: .14,
      preparation: .08,
    },
    week: {
      order: 1,
      'sold-stock': 1,
      live: 5,
      ready: 6,
      listing: 7,
      photography: 9,
      preparation: 11,
    },
  },
  base: {
    priceFactor: .93,
    expenseFactor: 1,
    probability: {
      order: 1,
      'sold-stock': 1,
      live: .58,
      ready: .45,
      listing: .34,
      photography: .24,
      preparation: .15,
    },
    week: {
      order: 1,
      'sold-stock': 1,
      live: 3,
      ready: 4,
      listing: 5,
      photography: 7,
      preparation: 9,
    },
  },
  optimistic: {
    priceFactor: 1,
    expenseFactor: .9,
    probability: {
      order: 1,
      'sold-stock': 1,
      live: .78,
      ready: .66,
      listing: .54,
      photography: .40,
      preparation: .28,
    },
    week: {
      order: 1,
      'sold-stock': 1,
      live: 2,
      ready: 3,
      listing: 4,
      photography: 5,
      preparation: 7,
    },
  },
}

const FINAL_ORDER_STATUS =
  /dispatched|delivered|completed|archived|cancelled|refunded|returned/i

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function validDate(value?: string): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 86_400_000)
}

function last90DaysTransactions(
  finance: FinanceState,
  now: Date,
): FinanceState['transactions'] {
  const start = addDays(now, -90)
  return finance.transactions.filter(transaction => {
    const date = validDate(transaction.date)
    return Boolean(date && date >= start && date <= now)
  })
}

function stageKey(item: InventoryItem):
  'live' | 'ready' | 'listing' | 'photography' | 'preparation' {
  if (item.status === 'Live') return 'live'
  const stage = inferPipelineStage(item)
  if (stage === 'Ready to Upload') return 'ready'
  if (stage === 'Listing Copy' || item.status === 'Photographed') return 'listing'
  if (stage === 'Photography' || stage === 'Photo Review') return 'photography'
  return 'preparation'
}

function spreadWeek(
  baseWeek: number,
  index: number,
  horizonWeeks: number,
): number {
  return Math.min(horizonWeeks, Math.max(1, baseWeek + (index % 3)))
}

function plannedCap(
  cash: number,
  emergencyReserve: number,
  taxReserveShortfall: number,
  plannedSourcingBudget: number,
): number {
  const safeCash = Math.max(
    0,
    cash - Math.max(0, emergencyReserve) - Math.max(0, taxReserveShortfall),
  )
  return plannedSourcingBudget > 0
    ? Math.min(safeCash, plannedSourcingBudget)
    : safeCash
}

function confidence(
  inventoryDataQuality: number,
  linkedSales: number,
  salesLast90Days: number,
  expensesLast90Days: number,
  dateCoverage: number,
): {
  confidence: ForecastConfidence
  score: number
  reason: string
} {
  const score = clamp(
    inventoryDataQuality * .38 +
    Math.min(100, linkedSales * 9) * .23 +
    Math.min(100, salesLast90Days * 12) * .17 +
    Math.min(100, expensesLast90Days * 15) * .10 +
    dateCoverage * .12,
  )

  if (score >= 76) {
    return {
      confidence: 'high',
      score,
      reason: 'The forecast is supported by strong inventory records, linked sales and recent ledger evidence.',
    }
  }
  if (score >= 50) {
    return {
      confidence: 'medium',
      score,
      reason: 'The forecast is usable for planning, but some sales, timing or expense assumptions remain lightly evidenced.',
    }
  }
  return {
    confidence: 'low',
    score,
    reason: 'The forecast is mainly scenario-based because completed sales or expense history is limited.',
  }
}

function buildCandidates(
  items: InventoryItem[],
  orders: OrderRecord[],
  finance: FinanceState,
  scenario: ForecastScenario,
  horizonWeeks: number,
): ForecastCandidate[] {
  const rules = scenarioRules[scenario]
  const itemMap = new Map(items.map(item => [item.sku, item]))
  const recordedSaleSkus = new Set(
    finance.transactions
      .filter(transaction => transaction.type === 'sale' && transaction.sku)
      .map(transaction => transaction.sku as string),
  )
  const activeOrders = orders.filter(order => !FINAL_ORDER_STATUS.test(order.status))
  const activeOrderSkus = new Set(activeOrders.map(order => order.sku).filter(Boolean))
  const candidates: ForecastCandidate[] = []

  activeOrders.forEach((order, index) => {
    if (order.sku && recordedSaleSkus.has(order.sku)) return
    const item = itemMap.get(order.sku)
    const price = Math.max(
      0,
      order.salePrice ??
      item?.actualSalePrice ??
      item?.expectedSalePrice ??
      0,
    )
    candidates.push({
      sku: order.sku || order.id,
      brand: item?.brand ?? 'Order',
      source: 'order',
      scheduledWeek: Math.min(horizonWeeks, rules.week.order),
      probability: rules.probability.order,
      projectedRevenue: price,
      projectedCost: item?.purchasePrice ?? 0,
    })
  })

  items
    .filter(item =>
      item.status === 'Sold' &&
      !activeOrderSkus.has(item.sku) &&
      !recordedSaleSkus.has(item.sku),
    )
    .forEach((item, index) => {
      candidates.push({
        sku: item.sku,
        brand: item.brand,
        source: 'sold-stock',
        scheduledWeek: Math.min(horizonWeeks, rules.week['sold-stock']),
        probability: rules.probability['sold-stock'],
        projectedRevenue: Math.max(
          0,
          item.actualSalePrice ?? item.expectedSalePrice,
        ),
        projectedCost: Math.max(0, item.purchasePrice),
      })
    })

  const futureInventory = items.filter(item =>
    !['Sold', 'Dispatched', 'Archived'].includes(item.status) &&
    !activeOrderSkus.has(item.sku) &&
    !recordedSaleSkus.has(item.sku),
  )

  futureInventory.forEach((item, index) => {
    const key = stageKey(item)
    const probability = rules.probability[key]
    candidates.push({
      sku: item.sku,
      brand: item.brand,
      source: 'inventory',
      scheduledWeek: spreadWeek(rules.week[key], index, horizonWeeks),
      probability,
      projectedRevenue: Math.max(0, item.expectedSalePrice) *
        rules.priceFactor *
        probability,
      projectedCost: Math.max(0, item.purchasePrice) * probability,
    })
  })

  return candidates
}

function calculateScenario(
  items: InventoryItem[],
  orders: OrderRecord[],
  settings: JosSettings,
  scenario: ForecastScenario,
  now: Date,
  horizonWeeks: number,
  monthlyProfitTarget: number,
): {
  weeks: ForecastWeek[]
  candidates: ForecastCandidate[]
  summary: ForecastScenarioSummary
  historicalWeeklySales: number
  historicalWeeklyExpenses: number
} {
  const financeState = normaliseFinanceState(settings.finance)
  const finance = calculateFinanceSummary(financeState, items, now)
  const rules = scenarioRules[scenario]
  const recent = last90DaysTransactions(financeState, now)
  const salesLast90 = recent
    .filter(transaction => transaction.type === 'sale')
    .reduce((sum, transaction) => sum + Math.max(0, transaction.amount), 0)
  const expensesLast90 = recent
    .filter(transaction => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + Math.max(0, transaction.amount), 0)
  const historicalWeeklySales = salesLast90 / (90 / 7)
  const historicalWeeklyExpenses =
    (expensesLast90 / (90 / 7)) * rules.expenseFactor
  const candidates = buildCandidates(
    items,
    orders,
    financeState,
    scenario,
    horizonWeeks,
  )

  const weeks: ForecastWeek[] = []
  let openingCash = finance.cashBalance

  for (let week = 1; week <= horizonWeeks; week += 1) {
    const startDate = addDays(now, (week - 1) * 7)
    const endDate = addDays(startDate, 6)
    const weekCandidates = candidates.filter(
      candidate => candidate.scheduledWeek === week,
    )
    const projectedSales = weekCandidates.reduce(
      (sum, candidate) => sum + candidate.projectedRevenue,
      0,
    )
    const projectedCostOfGoods = weekCandidates.reduce(
      (sum, candidate) => sum + candidate.projectedCost,
      0,
    )
    const projectedItemsSold = weekCandidates.reduce(
      (sum, candidate) => sum + candidate.probability,
      0,
    )
    const projectedExpenses = historicalWeeklyExpenses
    const projectedOperatingProfit =
      projectedSales - projectedCostOfGoods - projectedExpenses
    const projectedTaxReserve =
      Math.max(0, projectedOperatingProfit) *
      (Math.max(0, financeState.taxPlanningRate) / 100)

    // Inventory purchase cost is not subtracted here because this forecast starts
    // from the recorded Finance cash balance. Historic purchases must already be
    // reflected in that balance or ledger to avoid silently double-counting them.
    const closingCash =
      openingCash +
      projectedSales -
      projectedExpenses -
      projectedTaxReserve

    weeks.push({
      week,
      startDate: isoDate(startDate),
      endDate: isoDate(endDate),
      openingCash,
      projectedSales,
      projectedCostOfGoods,
      projectedExpenses,
      projectedTaxReserve,
      projectedOperatingProfit,
      projectedItemsSold,
      closingCash,
      safeSourcingCapacity: plannedCap(
        closingCash,
        financeState.emergencyReserve,
        finance.additionalTaxReserveNeeded,
        financeState.plannedSourcingBudget,
      ),
    })

    openingCash = closingCash
  }

  const projectedSales = weeks.reduce(
    (sum, week) => sum + week.projectedSales,
    0,
  )
  const projectedOperatingProfit = weeks.reduce(
    (sum, week) => sum + week.projectedOperatingProfit,
    0,
  )
  const rolling30DayProfit =
    finance.monthOperatingProfit +
    weeks.slice(0, 4).reduce(
      (sum, week) => sum + week.projectedOperatingProfit,
      0,
    )
  const targetProgress = monthlyProfitTarget > 0
    ? clamp((rolling30DayProfit / monthlyProfitTarget) * 100)
    : 100
  const projectedEndCash = weeks.at(-1)?.closingCash ?? finance.cashBalance
  const lowestCashPoint = Math.min(
    finance.cashBalance,
    ...weeks.map(week => week.closingCash),
  )

  return {
    weeks,
    candidates,
    historicalWeeklySales,
    historicalWeeklyExpenses,
    summary: {
      scenario,
      projectedSales,
      projectedOperatingProfit,
      projectedEndCash,
      lowestCashPoint,
      projectedItemsSold: weeks.reduce(
        (sum, week) => sum + week.projectedItemsSold,
        0,
      ),
      rolling30DayProfit,
      monthlyTargetGap: Math.max(0, monthlyProfitTarget - rolling30DayProfit),
      targetProgress,
      safeSourcingCapacity: weeks.at(-1)?.safeSourcingCapacity ??
        finance.availableSourcingBudget,
    },
  }
}

export function calculateBusinessForecast(
  items: InventoryItem[],
  orders: OrderRecord[],
  settings: JosSettings,
  options: Partial<ForecastOptions> = {},
  now = new Date(),
): BusinessForecastReport {
  const scenario = options.scenario ?? 'base'
  const horizonWeeks = Math.max(
    4,
    Math.min(26, Math.round(options.horizonWeeks ?? 12)),
  )
  const monthlyProfitTarget = Math.max(
    0,
    options.monthlyProfitTarget ?? settings.monthlyProfitTarget ?? 5000,
  )
  const financeState = normaliseFinanceState(settings.finance)
  const finance = calculateFinanceSummary(financeState, items, now)
  const inventory = calculateInventoryIntelligence(
    items,
    settings.finance,
    now,
  )
  const brands = calculateBrandPerformance(
    items,
    settings.finance,
    {
      targetRoi: settings.targetRoi,
      minimumProfit: settings.minimumProfit,
    },
    now,
  )
  const recent = last90DaysTransactions(financeState, now)
  const salesTransactions = recent.filter(
    transaction => transaction.type === 'sale',
  )
  const expenseTransactions = recent.filter(
    transaction => transaction.type === 'expense',
  )
  const itemsWithDates = items.filter(
    item => Boolean(item.dateSourced || item.dateListed),
  ).length
  const dateCoverage = items.length > 0
    ? (itemsWithDates / items.length) * 100
    : 100
  const confidenceResult = confidence(
    inventory.dataQuality.score,
    brands.dataQuality.linkedSales,
    salesTransactions.length,
    expenseTransactions.length,
    dateCoverage,
  )

  const scenarioResults = {
    conservative: calculateScenario(
      items,
      orders,
      settings,
      'conservative',
      now,
      horizonWeeks,
      monthlyProfitTarget,
    ),
    base: calculateScenario(
      items,
      orders,
      settings,
      'base',
      now,
      horizonWeeks,
      monthlyProfitTarget,
    ),
    optimistic: calculateScenario(
      items,
      orders,
      settings,
      'optimistic',
      now,
      horizonWeeks,
      monthlyProfitTarget,
    ),
  }
  const selected = scenarioResults[scenario]
  const warnings: string[] = []

  if (salesTransactions.length < 3) {
    warnings.push('Fewer than three sales were recorded in the last 90 days, so demand timing is mainly scenario-based.')
  }
  if (expenseTransactions.length === 0) {
    warnings.push('No recent operating expenses are recorded; future expense projections currently use £0.')
  }
  if (finance.additionalTaxReserveNeeded > 0) {
    warnings.push(`The current planning tax reserve is short by £${finance.additionalTaxReserveNeeded.toFixed(2)}.`)
  }
  if (finance.cashBalance === 0 && financeState.openingCash === 0) {
    warnings.push('No opening or recorded business cash exists, so the projected cash line starts at £0.')
  }
  if (dateCoverage < 70) {
    warnings.push('Many stock records lack sourced or listed dates, reducing timing confidence.')
  }
  if (brands.dataQuality.unlinkedSales > 0) {
    warnings.push(`${brands.dataQuality.unlinkedSales} finance sales are not linked to inventory SKUs.`)
  }

  return {
    generatedAt: now.toISOString(),
    scenario,
    horizonWeeks,
    monthlyProfitTarget,
    weeks: selected.weeks,
    candidates: selected.candidates,
    summary: selected.summary,
    scenarioComparison: {
      conservative: scenarioResults.conservative.summary,
      base: scenarioResults.base.summary,
      optimistic: scenarioResults.optimistic.summary,
    },
    currentCash: finance.cashBalance,
    currentMonthRealisedProfit: finance.monthOperatingProfit,
    currentTaxReserveBalance: finance.taxReserveBalance,
    currentTaxReserveShortfall: finance.additionalTaxReserveNeeded,
    emergencyReserve: financeState.emergencyReserve,
    plannedSourcingCap: financeState.plannedSourcingBudget,
    historicalWeeklySales: selected.historicalWeeklySales,
    historicalWeeklyExpenses: selected.historicalWeeklyExpenses,
    confidence: confidenceResult.confidence,
    confidenceScore: confidenceResult.score,
    confidenceReason: confidenceResult.reason,
    evidence: {
      linkedSales: brands.dataQuality.linkedSales,
      unlinkedSales: brands.dataQuality.unlinkedSales,
      salesLast90Days: salesTransactions.length,
      expensesLast90Days: expenseTransactions.length,
      activeItems: inventory.activeItems,
      itemsWithDates,
      inventoryDataQuality: inventory.dataQuality.score,
    },
    assumptions: [
      'Conservative, Base and Optimistic scenarios use different selling probabilities, timing and price factors.',
      'Outstanding orders and sold stock without a recorded Finance sale are forecast at full recorded value.',
      'Future stock sales use expected values weighted by pipeline stage and scenario probability.',
      'Recent operating expenses are converted into a weekly run rate; owner funding and withdrawals are not repeated.',
      'Tax reserve additions use the Finance planning percentage and are not an HMRC liability calculation.',
      'Historic stock purchase costs are not subtracted from future cash because the forecast starts from recorded cash.',
      'The monthly target view is a rolling 30-day planning comparison, not a guarantee of calendar-month profit.',
      'Safe sourcing capacity is a maximum after emergency reserve and current tax-reserve shortfall—not a spending target.',
    ],
    warnings,
  }
}
