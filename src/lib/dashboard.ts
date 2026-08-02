import type { InventoryItem, OrderRecord, StockStatus } from '../types/inventory'
import { expectedProfit, itemRoi } from './inventory'

export type CeoMission = {
  id: string
  title: string
  detail: string
  status?: StockStatus
  destination: 'inventory' | 'orders' | 'add' | 'sourcecheck'
  minutes: number
  impact: string
  priority: number
}

export type BrandForecast = {
  brand: string
  itemCount: number
  cost: number
  expectedSales: number
  expectedProfit: number
  averageRoi: number
}

export type CeoDashboardMetrics = {
  activeItems: number
  inventoryCost: number
  expectedSales: number
  expectedProfit: number
  realisedRevenue: number
  realisedProfit: number
  liveItems: number
  prepItems: number
  photographedItems: number
  soldItems: number
  missingStorage: number
  exitItems: number
  ageingItems: number
  ordersWaiting: number
  businessHealth: number
  healthLabel: string
  healthReasons: Array<{ label: string; value: string; tone: 'good' | 'warning' | 'urgent' }>
  missions: CeoMission[]
  missionMinutes: number
  missionImpact: string
  brands: BrandForecast[]
  topBrand?: BrandForecast
  launchDays: number
}

const closedStatuses: StockStatus[] = ['Dispatched', 'Archived']

function money(value: number): string {
  return `£${value.toFixed(2)}`
}

function buildMissions(
  prep: number,
  photographed: number,
  sold: number,
  ordersWaiting: number,
  missingStorage: number,
  ageingItems: number,
  liveItems: number,
): CeoMission[] {
  const candidates: CeoMission[] = []

  if (ordersWaiting > 0 || sold > 0) {
    const count = Math.max(ordersWaiting, sold)
    candidates.push({
      id: 'dispatch',
      title: `Pack or dispatch ${Math.min(count, 4)} ${count === 1 ? 'order' : 'orders'}`,
      detail: 'Customer commitments outrank sourcing and listing work.',
      status: 'Sold',
      destination: ordersWaiting > 0 ? 'orders' : 'inventory',
      minutes: Math.min(count, 4) * 8,
      impact: 'Protects dispatch performance',
      priority: 100,
    })
  }

  if (photographed > 0) {
    const count = Math.min(photographed, 6)
    candidates.push({
      id: 'list',
      title: `List ${count} photographed ${count === 1 ? 'item' : 'items'}`,
      detail: 'These records are closest to becoming revenue-producing live stock.',
      status: 'Photographed',
      destination: 'inventory',
      minutes: count * 12,
      impact: `Unlocks ${count} potential listings`,
      priority: 90,
    })
  }

  if (prep > 0) {
    const count = Math.min(prep, 6)
    candidates.push({
      id: 'prepare',
      title: `Prepare ${count} stock ${count === 1 ? 'item' : 'items'}`,
      detail: 'Reduce the preparation backlog and feed the photography queue.',
      status: 'Prep',
      destination: 'inventory',
      minutes: count * 10,
      impact: `Moves ${count} items forward`,
      priority: 80,
    })
  }

  if (missingStorage > 0) {
    const count = Math.min(missingStorage, 8)
    candidates.push({
      id: 'storage',
      title: `Assign storage to ${count} ${count === 1 ? 'item' : 'items'}`,
      detail: 'Stock without a location becomes expensive to find after a sale.',
      destination: 'inventory',
      minutes: count * 3,
      impact: 'Reduces fulfilment mistakes',
      priority: 70,
    })
  }

  if (ageingItems > 0) {
    const count = Math.min(ageingItems, 5)
    candidates.push({
      id: 'ageing',
      title: `Review ${count} ageing ${count === 1 ? 'listing' : 'listings'}`,
      detail: 'Check pricing, photos and whether cash should be released.',
      status: 'Live',
      destination: 'inventory',
      minutes: count * 6,
      impact: 'Challenges slow-moving stock',
      priority: 60,
    })
  }

  if (liveItems === 0 && prep === 0 && photographed === 0) {
    candidates.push({
      id: 'source',
      title: 'Run SourceCheck before the next sourcing trip',
      detail: 'The pipeline is clear, so the next constraint is quality stock acquisition.',
      destination: 'sourcecheck',
      minutes: 20,
      impact: 'Improves buying discipline',
      priority: 50,
    })
  }

  const sorted = candidates.sort((a, b) => b.priority - a.priority)
  const plan: CeoMission[] = []
  let minutes = 0

  for (const mission of sorted) {
    if (plan.length >= 4) break
    if (minutes + mission.minutes <= 120 || plan.length === 0) {
      plan.push(mission)
      minutes += mission.minutes
    }
  }

  if (plan.length === 0) {
    plan.push({
      id: 'review',
      title: 'Review inventory quality and sourcing targets',
      detail: 'No immediate operational bottleneck is visible from the current data.',
      destination: 'inventory',
      minutes: 30,
      impact: 'Keeps the business deliberate',
      priority: 10,
    })
  }

  return plan
}

export function calculateCeoDashboard(
  items: InventoryItem[],
  orders: OrderRecord[],
  launchDate = new Date('2027-01-01T00:00:00'),
  now = new Date(),
): CeoDashboardMetrics {
  const active = items.filter(item => !closedStatuses.includes(item.status))
  const inventoryCost = active.reduce((sum, item) => sum + item.purchasePrice, 0)
  const expectedSales = active.reduce((sum, item) => sum + item.expectedSalePrice, 0)
  const expectedProfitTotal = active.reduce((sum, item) => sum + expectedProfit(item), 0)

  const realisedItems = items.filter(
    item => ['Sold', 'Dispatched', 'Archived'].includes(item.status) && typeof item.actualSalePrice === 'number',
  )
  const realisedRevenue = realisedItems.reduce((sum, item) => sum + (item.actualSalePrice ?? 0), 0)
  const realisedProfit = realisedItems.reduce(
    (sum, item) => sum + (item.actualSalePrice ?? 0) - item.purchasePrice,
    0,
  )

  const prepItems = items.filter(item => item.status === 'Prep').length
  const photographedItems = items.filter(item => item.status === 'Photographed').length
  const soldItems = items.filter(item => item.status === 'Sold').length
  const liveItems = items.filter(item => item.status === 'Live').length
  const missingStorage = active.filter(
    item => !item.storageLocation || item.storageLocation.trim().toUpperCase() === 'TBC',
  ).length
  const exitItems = active.filter(item => item.grade === 'Exit').length
  const ageingItems = active.filter(
    item => item.status === 'Live' && (item.daysInStock ?? 0) >= 60,
  ).length
  const ordersWaiting = orders.filter(
    order => !/completed|delivered|archived/i.test(order.status),
  ).length

  const backlogPenalty = Math.min(28, prepItems * 1.4 + photographedItems * 1.1)
  const dispatchPenalty = Math.min(24, Math.max(soldItems, ordersWaiting) * 7)
  const storagePenalty = Math.min(14, missingStorage * 0.7)
  const ageingPenalty = Math.min(16, ageingItems * 3)
  const exitPenalty = Math.min(10, exitItems * 2)
  const businessHealth = Math.max(
    0,
    Math.min(100, Math.round(100 - backlogPenalty - dispatchPenalty - storagePenalty - ageingPenalty - exitPenalty)),
  )

  const healthLabel =
    businessHealth >= 85 ? 'Strong' :
    businessHealth >= 70 ? 'Stable' :
    businessHealth >= 50 ? 'Needs attention' :
    'At risk'

  const healthReasons: CeoDashboardMetrics['healthReasons'] = [
    {
      label: 'Workflow backlog',
      value: prepItems + photographedItems === 0
        ? 'Clear'
        : `${prepItems + photographedItems} items`,
      tone: prepItems + photographedItems === 0 ? 'good' : prepItems + photographedItems <= 6 ? 'warning' : 'urgent',
    },
    {
      label: 'Dispatch position',
      value: Math.max(soldItems, ordersWaiting) === 0
        ? 'Clear'
        : `${Math.max(soldItems, ordersWaiting)} waiting`,
      tone: Math.max(soldItems, ordersWaiting) === 0 ? 'good' : 'urgent',
    },
    {
      label: 'Storage accuracy',
      value: missingStorage === 0 ? 'Complete' : `${missingStorage} missing`,
      tone: missingStorage === 0 ? 'good' : 'warning',
    },
    {
      label: 'Ageing live stock',
      value: ageingItems === 0 ? 'Healthy' : `${ageingItems} items`,
      tone: ageingItems === 0 ? 'good' : ageingItems <= 3 ? 'warning' : 'urgent',
    },
  ]

  const brandsMap = new Map<string, BrandForecast>()
  active.forEach(item => {
    const current = brandsMap.get(item.brand) ?? {
      brand: item.brand,
      itemCount: 0,
      cost: 0,
      expectedSales: 0,
      expectedProfit: 0,
      averageRoi: 0,
    }
    current.itemCount += 1
    current.cost += item.purchasePrice
    current.expectedSales += item.expectedSalePrice
    current.expectedProfit += expectedProfit(item)
    current.averageRoi += itemRoi(item)
    brandsMap.set(item.brand, current)
  })

  const brands = [...brandsMap.values()]
    .map(brand => ({
      ...brand,
      averageRoi: brand.itemCount ? brand.averageRoi / brand.itemCount : 0,
    }))
    .sort((a, b) => b.expectedProfit - a.expectedProfit)

  const missions = buildMissions(
    prepItems,
    photographedItems,
    soldItems,
    ordersWaiting,
    missingStorage,
    ageingItems,
    liveItems,
  )
  const missionMinutes = missions.reduce((sum, mission) => sum + mission.minutes, 0)
  const missionImpact = missions.map(mission => mission.impact).join(' · ')

  const launchDays = Math.max(
    0,
    Math.ceil((launchDate.getTime() - now.getTime()) / 86_400_000),
  )

  return {
    activeItems: active.length,
    inventoryCost,
    expectedSales,
    expectedProfit: expectedProfitTotal,
    realisedRevenue,
    realisedProfit,
    liveItems,
    prepItems,
    photographedItems,
    soldItems,
    missingStorage,
    exitItems,
    ageingItems,
    ordersWaiting,
    businessHealth,
    healthLabel,
    healthReasons,
    missions,
    missionMinutes,
    missionImpact,
    brands,
    topBrand: brands[0],
    launchDays,
  }
}

export function formatCeoMoney(value: number): string {
  return money(value)
}
