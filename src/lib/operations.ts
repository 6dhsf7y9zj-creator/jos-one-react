import type { InventoryItem, OrderRecord, StockStatus } from '../types/inventory'
import { expectedProfit } from './inventory'
import { inferPipelineStage, listingCompletion, photoCompletion } from './pipeline'

export type OperationsDestination = 'inventory' | 'pipeline' | 'orders' | 'finance' | 'sourcecheck'

export type OperationsTask = {
  id: string
  title: string
  detail: string
  actionLabel: string
  destination: OperationsDestination
  status?: StockStatus
  sku?: string
  priority: number
  minutes: number
  expectedProfit?: number
  tone: 'urgent' | 'warning' | 'growth' | 'standard'
  canAdvance?: boolean
}

export type OperationsStage = {
  label: string
  count: number
  targetMinutes: number
}

export type OperationsSummary = {
  score: number
  label: string
  tasks: OperationsTask[]
  totalMinutes: number
  ordersWaiting: number
  pipelineWaiting: number
  readyToUpload: number
  missingMeasurements: number
  missingCondition: number
  slowStock: number
  bottleneck: OperationsStage
  stages: OperationsStage[]
  weekly: {
    sourced: number
    photographed: number
    ready: number
    listed: number
    sold: number
  }
}

function dateWithinDays(value: string | undefined, days: number, now: Date): boolean {
  if (!value) return false
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return false
  const difference = now.getTime() - parsed.getTime()
  return difference >= 0 && difference <= days * 86_400_000
}

function orderIsWaiting(order: OrderRecord): boolean {
  return !/completed|delivered|archived|dispatched/i.test(order.status)
}

function itemTitle(item: InventoryItem): string {
  return `${item.sku} · ${item.brand} ${item.category}`
}

export function calculateOperations(
  items: InventoryItem[],
  orders: OrderRecord[],
  now = new Date(),
): OperationsSummary {
  const active = items.filter(item => !['Sold', 'Dispatched', 'Archived'].includes(item.status))
  const waitingOrders = orders.filter(orderIsWaiting)
  const soldWaiting = items.filter(item => item.status === 'Sold')
  const tasks: OperationsTask[] = []

  waitingOrders.slice(0, 4).forEach((order, index) => {
    tasks.push({
      id: `order-${order.id}`,
      title: `Pack or dispatch ${order.id}`,
      detail: `${order.item}${order.deadline ? ` · ${order.deadline}` : ''}`,
      actionLabel: 'Open orders',
      destination: 'orders',
      priority: 1000 - index,
      minutes: 8,
      tone: 'urgent',
    })
  })

  soldWaiting.slice(0, 4).forEach((item, index) => {
    tasks.push({
      id: `sold-${item.sku}`,
      title: `Prepare sold item ${item.sku}`,
      detail: `${item.brand} ${item.category} is marked Sold but not dispatched.`,
      actionLabel: 'Open sold stock',
      destination: 'inventory',
      status: 'Sold',
      sku: item.sku,
      priority: 950 - index,
      minutes: 8,
      expectedProfit: expectedProfit(item),
      tone: 'urgent',
    })
  })

  active.forEach(item => {
    const stage = inferPipelineStage(item)
    const profit = expectedProfit(item)
    const priorityProfit = Math.min(80, Math.max(0, profit * 2))

    if (stage === 'Ready to Upload') {
      tasks.push({
        id: `upload-${item.sku}`,
        title: `Publish ${itemTitle(item)}`,
        detail: `Ready to upload · £${profit.toFixed(2)} expected profit.`,
        actionLabel: 'Mark live',
        destination: 'pipeline',
        sku: item.sku,
        priority: 800 + priorityProfit,
        minutes: 6,
        expectedProfit: profit,
        tone: 'growth',
        canAdvance: true,
      })
    } else if (stage === 'Listing Copy') {
      tasks.push({
        id: `listing-${item.sku}`,
        title: `Finish listing for ${itemTitle(item)}`,
        detail: `${listingCompletion(item)}% listing copy complete · £${profit.toFixed(2)} expected profit.`,
        actionLabel: 'Open pipeline',
        destination: 'pipeline',
        sku: item.sku,
        priority: 700 + priorityProfit,
        minutes: 12,
        expectedProfit: profit,
        tone: 'growth',
      })
    } else if (stage === 'Photo Review') {
      tasks.push({
        id: `review-${item.sku}`,
        title: `Review photos for ${itemTitle(item)}`,
        detail: `${photoCompletion(item)}% photography checklist complete.`,
        actionLabel: 'Open checklist',
        destination: 'pipeline',
        sku: item.sku,
        priority: 650 + priorityProfit,
        minutes: 5,
        expectedProfit: profit,
        tone: 'warning',
      })
    } else if (stage === 'Photography') {
      tasks.push({
        id: `photo-${item.sku}`,
        title: `Photograph ${itemTitle(item)}`,
        detail: `${photoCompletion(item)}% photography complete · £${profit.toFixed(2)} expected profit.`,
        actionLabel: 'Open checklist',
        destination: 'pipeline',
        sku: item.sku,
        priority: 600 + priorityProfit,
        minutes: 10,
        expectedProfit: profit,
        tone: 'warning',
      })
    } else if (stage === 'Preparation') {
      tasks.push({
        id: `prep-${item.sku}`,
        title: `Prepare ${itemTitle(item)}`,
        detail: `Move this item into the photography queue.`,
        actionLabel: 'Start photography',
        destination: 'pipeline',
        sku: item.sku,
        priority: 500 + priorityProfit,
        minutes: 10,
        expectedProfit: profit,
        tone: 'standard',
        canAdvance: true,
      })
    }
  })

  const missingMeasurementsItems = active.filter(item => {
    const photos = item.photoChecklist?.measurements === true
    const listing = item.listingChecklist?.measurements === true
    return !photos && !listing
  })
  const missingConditionItems = active.filter(item => !item.condition.trim() || /tbc|unknown/i.test(item.condition))
  const slowItems = active.filter(item => item.status === 'Live' && (item.daysInStock ?? 0) >= 60)

  if (missingMeasurementsItems.length > 0) {
    tasks.push({
      id: 'missing-measurements',
      title: `Add measurements to ${missingMeasurementsItems.length} ${missingMeasurementsItems.length === 1 ? 'item' : 'items'}`,
      detail: 'Missing measurements weaken listing confidence and buyer decisions.',
      actionLabel: 'Open pipeline',
      destination: 'pipeline',
      priority: 430,
      minutes: Math.min(30, missingMeasurementsItems.length * 4),
      tone: 'warning',
    })
  }

  if (missingConditionItems.length > 0) {
    tasks.push({
      id: 'missing-condition',
      title: `Confirm condition for ${missingConditionItems.length} ${missingConditionItems.length === 1 ? 'item' : 'items'}`,
      detail: 'Condition must be explicit before listing.',
      actionLabel: 'Open inventory',
      destination: 'inventory',
      priority: 420,
      minutes: Math.min(24, missingConditionItems.length * 3),
      tone: 'warning',
    })
  }

  if (slowItems.length > 0) {
    tasks.push({
      id: 'slow-stock',
      title: `Review ${slowItems.length} slow-moving live ${slowItems.length === 1 ? 'item' : 'items'}`,
      detail: 'Review price, photos, description or whether cash should be released.',
      actionLabel: 'Review live stock',
      destination: 'inventory',
      status: 'Live',
      priority: 350,
      minutes: Math.min(30, slowItems.length * 5),
      tone: 'warning',
    })
  }

  const sortedTasks = tasks.sort((a, b) => b.priority - a.priority)
  const dailyTasks: OperationsTask[] = []
  let totalMinutes = 0
  for (const task of sortedTasks) {
    if (dailyTasks.length >= 10) break
    if (totalMinutes + task.minutes <= 120 || dailyTasks.length === 0) {
      dailyTasks.push(task)
      totalMinutes += task.minutes
    }
  }

  const stages: OperationsStage[] = [
    { label: 'Preparation', count: active.filter(item => inferPipelineStage(item) === 'Preparation').length, targetMinutes: 10 },
    { label: 'Photography', count: active.filter(item => inferPipelineStage(item) === 'Photography').length, targetMinutes: 10 },
    { label: 'Photo Review', count: active.filter(item => inferPipelineStage(item) === 'Photo Review').length, targetMinutes: 5 },
    { label: 'Listing Copy', count: active.filter(item => inferPipelineStage(item) === 'Listing Copy').length, targetMinutes: 12 },
    { label: 'Ready to Upload', count: active.filter(item => inferPipelineStage(item) === 'Ready to Upload').length, targetMinutes: 6 },
    { label: 'Live', count: active.filter(item => inferPipelineStage(item) === 'Live').length, targetMinutes: 0 },
  ]
  const waitingStages = stages.filter(stage => stage.label !== 'Live')
  const bottleneck = waitingStages.reduce(
    (largest, current) => current.count > largest.count ? current : largest,
    waitingStages[0],
  )

  const backlog = stages.slice(0, 5).reduce((sum, stage) => sum + stage.count, 0)
  const score = Math.max(0, Math.min(100, Math.round(
    100
    - Math.min(30, waitingOrders.length * 10 + soldWaiting.length * 8)
    - Math.min(25, backlog * 1.5)
    - Math.min(15, missingMeasurementsItems.length * 1.2)
    - Math.min(10, missingConditionItems.length * 2)
    - Math.min(20, slowItems.length * 3),
  )))
  const label = score >= 85 ? 'Excellent' : score >= 70 ? 'Stable' : score >= 50 ? 'Needs attention' : 'At risk'

  return {
    score,
    label,
    tasks: dailyTasks,
    totalMinutes,
    ordersWaiting: Math.max(waitingOrders.length, soldWaiting.length),
    pipelineWaiting: backlog,
    readyToUpload: stages.find(stage => stage.label === 'Ready to Upload')?.count ?? 0,
    missingMeasurements: missingMeasurementsItems.length,
    missingCondition: missingConditionItems.length,
    slowStock: slowItems.length,
    bottleneck,
    stages,
    weekly: {
      sourced: items.filter(item => dateWithinDays(item.dateSourced, 7, now)).length,
      photographed: items.filter(item => dateWithinDays(item.photographyCompletedAt, 7, now)).length,
      ready: items.filter(item => dateWithinDays(item.listingReadyAt, 7, now)).length,
      listed: items.filter(item => dateWithinDays(item.dateListed, 7, now)).length,
      sold: items.filter(item => dateWithinDays(item.dateSold, 7, now)).length,
    },
  }
}
