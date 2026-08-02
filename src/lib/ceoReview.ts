import type {
  FinanceState,
  InventoryItem,
  JosSettings,
  OrderRecord,
  StockStatus,
} from '../types/inventory'
import { calculateCeoDashboard } from './dashboard'
import { calculateFinanceSummary, normaliseFinanceState } from './finance'
import { calculateOperations } from './operations'
import { inferPipelineStage, pipelineBottleneck, pipelineReadiness } from './pipeline'
import { buildBusinessIntelligence } from './intelligence'
import { expectedProfit, itemRoi } from './inventory'
import { estimateAllSnapshotBytes, getAutoBackups } from './autoBackup'

export type ReviewPriority = {
  id: string
  title: string
  detail: string
  urgency: 'urgent' | 'warning' | 'normal'
  destination: 'orders' | 'pipeline' | 'inventory' | 'finance' | 'intelligence' | 'backup'
  status?: StockStatus
  value?: string
}

export type ReviewChecklistItem = {
  id: string
  label: string
  complete: boolean
  detail: string
}

export type CeoReview = {
  generatedAt: string
  businessHealth: number
  healthLabel: string
  cashBalance: number
  availableSourcingBudget: number
  inventoryCost: number
  expectedSales: number
  expectedProfit: number
  realisedProfit: number
  weeklySales: number
  weeklyExpenses: number
  priorities: ReviewPriority[]
  recommendation: {
    title: string
    explanation: string
    destination: ReviewPriority['destination']
  }
  healthBreakdown: Array<{
    label: string
    score: number
    detail: string
  }>
  workflow: {
    prep: number
    photography: number
    listing: number
    ready: number
    live: number
    sold: number
    dispatchWaiting: number
  }
  topForecastBrand?: {
    brand: string
    expectedProfit: number
    averageRoi: number
    itemCount: number
  }
  realisedBrand?: {
    brand: string
    realisedProfit: number
    realisedSales: number
    confidence: string
  }
  checklist: ReviewChecklistItem[]
  backup: {
    latestAt?: string
    ageHours?: number
    snapshots: number
    storageBytes: number
    protectedItems: number
  }
  dataTruth: string[]
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function startOfWeek(now: Date): Date {
  const value = new Date(now)
  const day = value.getDay()
  const diff = day === 0 ? 6 : day - 1
  value.setDate(value.getDate() - diff)
  value.setHours(0, 0, 0, 0)
  return value
}

function recentTransactions(finance: FinanceState, now: Date) {
  const start = startOfWeek(now)
  return finance.transactions.filter(transaction => {
    const date = new Date(`${transaction.date}T12:00:00`)
    return date >= start && date <= now
  })
}

export function buildCeoReview(
  items: InventoryItem[],
  orders: OrderRecord[],
  settings: JosSettings,
  now = new Date(),
): CeoReview {
  const finance = normaliseFinanceState(settings.finance)
  const ceo = calculateCeoDashboard(items, orders, new Date('2027-01-01T00:00:00'), now)
  const financeSummary = calculateFinanceSummary(finance, items, now)
  const operations = calculateOperations(items, orders, now)
  const intelligence = buildBusinessIntelligence(items, finance, now)
  const active = items.filter(item => !['Sold', 'Dispatched', 'Archived'].includes(item.status))
  const weekTransactions = recentTransactions(finance, now)
  const weeklySales = weekTransactions
    .filter(transaction => transaction.type === 'sale')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const weeklyExpenses = weekTransactions
    .filter(transaction => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0)

  const stages = {
    prep: active.filter(item => inferPipelineStage(item) === 'Preparation').length,
    photography: active.filter(item => ['Photography', 'Photo Review'].includes(inferPipelineStage(item))).length,
    listing: active.filter(item => inferPipelineStage(item) === 'Listing Copy').length,
    ready: active.filter(item => inferPipelineStage(item) === 'Ready to Upload').length,
    live: items.filter(item => item.status === 'Live').length,
    sold: items.filter(item => item.status === 'Sold').length,
    dispatchWaiting: Math.max(
      orders.filter(order => !/completed|delivered|archived/i.test(order.status)).length,
      items.filter(item => item.status === 'Sold').length,
    ),
  }

  const bottleneck = pipelineBottleneck(active)
  const missingMeasurements = active.filter(item =>
    !item.photoChecklist?.measurements && !item.listingChecklist?.measurements,
  ).length
  const missingStorage = active.filter(item =>
    !item.storageLocation || item.storageLocation.trim().toUpperCase() === 'TBC',
  ).length
  const slowLive = active.filter(item => item.status === 'Live' && (item.daysInStock ?? 0) >= 60).length
  const readyValue = active
    .filter(item => inferPipelineStage(item) === 'Ready to Upload')
    .reduce((sum, item) => sum + expectedProfit(item), 0)
  const photographedValue = active
    .filter(item => ['Photo Review', 'Listing Copy'].includes(inferPipelineStage(item)))
    .reduce((sum, item) => sum + expectedProfit(item), 0)

  const priorities: ReviewPriority[] = []

  if (stages.dispatchWaiting > 0) {
    priorities.push({
      id: 'dispatch',
      title: `Dispatch ${stages.dispatchWaiting} ${stages.dispatchWaiting === 1 ? 'order' : 'orders'}`,
      detail: 'Customer commitments should be completed before listing or sourcing work.',
      urgency: 'urgent',
      destination: 'orders',
      value: 'Highest priority',
    })
  }

  if (stages.ready > 0) {
    priorities.push({
      id: 'ready',
      title: `Upload ${Math.min(stages.ready, 6)} ready ${stages.ready === 1 ? 'listing' : 'listings'}`,
      detail: 'These items are closest to becoming live revenue-producing stock.',
      urgency: 'warning',
      destination: 'pipeline',
      value: `£${readyValue.toFixed(2)} forecast profit`,
    })
  }

  if (stages.photography > 0) {
    priorities.push({
      id: 'photography',
      title: `Complete photography for ${Math.min(stages.photography, 6)} items`,
      detail: 'The photography queue is blocking stock from reaching listing copy.',
      urgency: 'warning',
      destination: 'pipeline',
      value: `£${photographedValue.toFixed(2)} forecast profit`,
    })
  }

  if (stages.prep > 0) {
    priorities.push({
      id: 'prep',
      title: `Prepare ${Math.min(stages.prep, 6)} stock items`,
      detail: 'Move sourced stock into the photography queue before buying more.',
      urgency: 'normal',
      destination: 'pipeline',
      value: `${stages.prep} waiting`,
    })
  }

  if (slowLive > 0) {
    priorities.push({
      id: 'slow',
      title: `Review ${slowLive} slow live ${slowLive === 1 ? 'item' : 'items'}`,
      detail: 'Check price, photos and whether cash should be released.',
      urgency: 'warning',
      destination: 'inventory',
      status: 'Live',
      value: '60+ days',
    })
  }

  if (missingMeasurements > 0) {
    priorities.push({
      id: 'measurements',
      title: `Add measurements to ${missingMeasurements} ${missingMeasurements === 1 ? 'item' : 'items'}`,
      detail: 'Missing measurements weaken listing quality and buyer confidence.',
      urgency: 'normal',
      destination: 'pipeline',
      value: 'Data incomplete',
    })
  }

  if (missingStorage > 0) {
    priorities.push({
      id: 'storage',
      title: `Assign storage to ${missingStorage} ${missingStorage === 1 ? 'item' : 'items'}`,
      detail: 'Items without a location increase dispatch mistakes and wasted time.',
      urgency: 'normal',
      destination: 'inventory',
      value: 'Location missing',
    })
  }

  const recommendation = stages.dispatchWaiting > 0
    ? {
        title: 'Dispatch before growth work.',
        explanation: 'Orders are already customer commitments. Complete them before photography, listing or sourcing.',
        destination: 'orders' as const,
      }
    : stages.ready > 0
      ? {
          title: 'Upload ready listings before sourcing.',
          explanation: `You already have ${stages.ready} items ready to upload. Converting them to live stock is a faster route to sales than buying more inventory.`,
          destination: 'pipeline' as const,
        }
      : stages.photography > 0 || stages.prep > 0
        ? {
            title: 'Clear the existing stock pipeline first.',
            explanation: `The current bottleneck is ${bottleneck.stage}. Buying more stock would increase cash tied up before current inventory reaches market.`,
            destination: 'pipeline' as const,
          }
        : financeSummary.availableSourcingBudget > 0
          ? {
              title: 'Source selectively within the recorded budget.',
              explanation: `JOS records up to £${financeSummary.availableSourcingBudget.toFixed(2)} as available after your emergency reserve and sourcing limit.`,
              destination: 'finance' as const,
            }
          : {
              title: 'Review Finance before sourcing.',
              explanation: 'JOS does not currently show spare sourcing cash after recorded reserves.',
              destination: 'finance' as const,
            }

  const latestBackups = getAutoBackups()
  const latestBackup = latestBackups[0]
  const backupAgeHours = latestBackup
    ? Math.max(0, (now.getTime() - new Date(latestBackup.createdAt).getTime()) / 3_600_000)
    : undefined

  const financeScore = clamp(
    70 +
      (financeSummary.cashBalance >= 0 ? 15 : -25) +
      (financeSummary.taxReserveBalance >= financeSummary.suggestedTaxReserve ? 10 : -10) +
      (finance.transactions.length > 0 ? 5 : -10),
  )
  const pipelineAverage = active.length
    ? active.reduce((sum, item) => sum + pipelineReadiness(item), 0) / active.length
    : 100
  const pipelineScore = clamp(pipelineAverage - stages.prep * 1.2 - stages.photography * .8)
  const dispatchScore = clamp(100 - stages.dispatchWaiting * 18)
  const dataScore = clamp(
    100 -
      missingStorage * 2 -
      missingMeasurements * 1.5 -
      items.filter(item => item.status === 'Sold' && typeof item.actualSalePrice !== 'number').length * 5,
  )
  const intelligenceScore = clamp(intelligence.dataQualityScore)
  const overall = clamp(
    ceo.businessHealth * .28 +
      financeScore * .20 +
      operations.score * .20 +
      pipelineScore * .15 +
      dispatchScore * .10 +
      dataScore * .07,
  )

  const forecastBrands = [...new Set(active.map(item => item.brand))]
    .map(brand => {
      const brandItems = active.filter(item => item.brand === brand)
      return {
        brand,
        expectedProfit: brandItems.reduce((sum, item) => sum + expectedProfit(item), 0),
        averageRoi: brandItems.length
          ? brandItems.reduce((sum, item) => sum + itemRoi(item), 0) / brandItems.length
          : 0,
        itemCount: brandItems.length,
      }
    })
    .sort((a, b) => b.expectedProfit - a.expectedProfit)

  const realisedBrands = intelligence.brands
    .filter(brand => brand.realisedSales > 0)
    .sort((a, b) => b.realisedProfit - a.realisedProfit)

  const checklist: ReviewChecklistItem[] = [
    {
      id: 'dispatch',
      label: 'Dispatch all waiting orders',
      complete: stages.dispatchWaiting === 0,
      detail: stages.dispatchWaiting === 0 ? 'No outstanding dispatch work.' : `${stages.dispatchWaiting} waiting.`,
    },
    {
      id: 'pipeline',
      label: 'Progress the highest-value pipeline work',
      complete: stages.ready + stages.photography + stages.prep === 0,
      detail: stages.ready + stages.photography + stages.prep === 0
        ? 'Pipeline clear.'
        : `${stages.ready + stages.photography + stages.prep} items waiting.`,
    },
    {
      id: 'slow',
      label: 'Review slow-moving live stock',
      complete: slowLive === 0,
      detail: slowLive === 0 ? 'No 60+ day live stock.' : `${slowLive} items require review.`,
    },
    {
      id: 'finance',
      label: 'Keep finance records current',
      complete: finance.transactions.length > 0,
      detail: finance.transactions.length > 0
        ? `${finance.transactions.length} ledger entries recorded.`
        : 'No finance ledger activity recorded yet.',
    },
    {
      id: 'backup',
      label: 'Maintain a current backup',
      complete: backupAgeHours !== undefined && backupAgeHours <= 24,
      detail: backupAgeHours === undefined
        ? 'No automatic snapshot available.'
        : backupAgeHours <= 24
          ? 'Backup is current.'
          : `Latest backup is ${Math.floor(backupAgeHours)} hours old.`,
    },
  ]

  const dataTruth = [
    'Expected sales and profit are forecasts until items sell.',
    'Available sourcing budget comes only from recorded Finance cash and reserve settings.',
    'Brand performance is labelled forecast or realised according to the evidence available.',
  ]

  return {
    generatedAt: now.toISOString(),
    businessHealth: overall,
    healthLabel:
      overall >= 85 ? 'Excellent' :
      overall >= 70 ? 'Stable' :
      overall >= 50 ? 'Needs attention' :
      'At risk',
    cashBalance: financeSummary.cashBalance,
    availableSourcingBudget: financeSummary.availableSourcingBudget,
    inventoryCost: financeSummary.inventoryCost,
    expectedSales: financeSummary.expectedInventorySales,
    expectedProfit: financeSummary.expectedInventoryProfit,
    realisedProfit: financeSummary.operatingProfit,
    weeklySales,
    weeklyExpenses,
    priorities: priorities.slice(0, 6),
    recommendation,
    healthBreakdown: [
      { label: 'Inventory', score: ceo.businessHealth, detail: `${active.length} active items` },
      { label: 'Finance', score: financeScore, detail: `Cash £${financeSummary.cashBalance.toFixed(2)}` },
      { label: 'Operations', score: operations.score, detail: `${operations.ordersWaiting + operations.pipelineWaiting} tasks waiting` },
      { label: 'Pipeline', score: pipelineScore, detail: `${bottleneck.stage} bottleneck` },
      { label: 'Dispatch', score: dispatchScore, detail: `${stages.dispatchWaiting} waiting` },
      { label: 'Data quality', score: Math.round((dataScore + intelligenceScore) / 2), detail: `${missingStorage + missingMeasurements} gaps` },
    ],
    workflow: stages,
    topForecastBrand: forecastBrands[0],
    realisedBrand: realisedBrands[0]
      ? {
          brand: realisedBrands[0].brand,
          realisedProfit: realisedBrands[0].realisedProfit,
          realisedSales: realisedBrands[0].realisedSales,
          confidence: realisedBrands[0].dataConfidence,
        }
      : undefined,
    checklist,
    backup: {
      latestAt: latestBackup?.createdAt,
      ageHours: backupAgeHours,
      snapshots: latestBackups.length,
      storageBytes: estimateAllSnapshotBytes(),
      protectedItems: latestBackup?.itemCount ?? 0,
    },
    dataTruth,
  }
}
