import type {
  AutomationSettings,
  InventoryItem,
  JosSettings,
  LaunchCommandSettings,
  LaunchTaskState,
  OrderRecord,
} from '../types/inventory.ts'
import {
  completeAutomationRule,
  normaliseAutomationSettings,
} from './automationCentre.ts'
import { calculateBusinessForecast } from './businessForecasting.ts'
import { calculateFinanceSummary } from './finance.ts'
import {
  inferPipelineStage,
  pipelineReadiness,
} from './pipeline.ts'

export type LaunchTaskGroup = 'marketing' | 'packaging' | 'launch-day'
export type LaunchTaskStatus = 'complete' | 'overdue' | 'due' | 'upcoming'
export type LaunchSeverity = 'critical' | 'warning' | 'information' | 'positive'
export type LaunchDestination =
  | 'inventory'
  | 'pipeline'
  | 'sourcecheck'
  | 'finance'
  | 'automation'
  | 'backup'
  | 'launch'

export type LaunchTaskDefinition = {
  id: string
  title: string
  description: string
  group: LaunchTaskGroup
  dueOffsetDays: number
}

export type LaunchTaskView = LaunchTaskDefinition & {
  completed: boolean
  completedAt?: string
  dueDate: string
  status: LaunchTaskStatus
  statusLabel: string
}

export type LaunchBlocker = {
  id: string
  title: string
  detail: string
  severity: LaunchSeverity
  destination: LaunchDestination
  actionLabel: string
  priority: number
}

export type LaunchBrandCoverage = {
  brand: string
  activeItems: number
  readyItems: number
  covered: boolean
}

export type LaunchCommandReport = {
  generatedAt: string
  launchDate: string
  daysRemaining: number
  phase: 'foundation' | 'build' | 'countdown' | 'launch-window' | 'past-date'
  overallReadiness: number
  readinessLabel: string
  stock: {
    target: number
    eligibleItems: number
    allActiveItems: number
    exitItems: number
    progress: number
    gap: number
    averagePurchaseCost: number
    estimatedGapCost: number
    currentSafeSourcingCash: number
    forecastSafeSourcingCash: number
    affordabilityGap: number
  }
  listings: {
    target: number
    readyItems: number
    liveItems: number
    photoCompleteItems: number
    listingCopyItems: number
    photographyItems: number
    preparationItems: number
    progress: number
    gap: number
    averageReadiness: number
  }
  brands: {
    priorityBrands: number
    coveredBrands: number
    progress: number
    coverage: LaunchBrandCoverage[]
  }
  grades: Record<InventoryItem['grade'], number>
  storageMissing: number
  marketing: {
    progress: number
    completed: number
    total: number
    overdue: number
    tasks: LaunchTaskView[]
  }
  packaging: {
    progress: number
    completed: number
    total: number
    tasks: LaunchTaskView[]
  }
  launchDay: {
    progress: number
    completed: number
    total: number
    tasks: LaunchTaskView[]
  }
  coreChecklist: {
    progress: number
    completed: number
    total: number
  }
  blockers: LaunchBlocker[]
  nextActions: LaunchBlocker[]
  evidence: {
    inventoryItemsUsed: number
    eligibleItemsUsed: number
    itemsWithPipelineData: number
    priorityBrandRecords: number
    financeCashBalance: number
    forecastConfidence: number
    launchReviewLastCompletedAt?: string
    commandReviewLastCompletedAt?: string
  }
  assumptions: string[]
}

export const DEFAULT_PRIORITY_BRANDS = [
  'Nike',
  'Adidas',
  "Levi's",
  'Wrangler',
  'Ralph Lauren',
  'The North Face',
  'Carhartt',
  'Superdry',
  'Tommy Hilfiger',
  'Napapijri',
]

export const MARKETING_TASKS: LaunchTaskDefinition[] = [
  {
    id: 'coming-soon',
    title: 'Publish Coming January teaser',
    description: 'Use the approved clean teaser style and announce the January 2027 launch.',
    group: 'marketing',
    dueOffsetDays: -120,
  },
  {
    id: 'our-story',
    title: 'Publish Our Story',
    description: 'Introduce The JAE Edit, the family meaning behind JAE and the long-term brand purpose.',
    group: 'marketing',
    dueOffsetDays: -100,
  },
  {
    id: 'why-preloved',
    title: 'Publish Why Choose Preloved',
    description: 'Explain value, quality and sustainability without overstating environmental claims.',
    group: 'marketing',
    dueOffsetDays: -80,
  },
  {
    id: 'featured-brands',
    title: 'Publish Featured Brands',
    description: 'Show the approved priority-brand direction for the opening collection.',
    group: 'marketing',
    dueOffsetDays: -60,
  },
  {
    id: 'quality-trust',
    title: 'Publish Quality and Trust posts',
    description: 'Cover quality checking, honest descriptions and trusted brands.',
    group: 'marketing',
    dueOffsetDays: -45,
  },
  {
    id: 'behind-scenes',
    title: 'Publish Packaging and Behind the Scenes',
    description: 'Show preparation, storage, photography and packaging care.',
    group: 'marketing',
    dueOffsetDays: -30,
  },
  {
    id: 'meet-jae',
    title: 'Publish Meet The JAE Edit',
    description: 'Create the personal introduction before the final countdown.',
    group: 'marketing',
    dueOffsetDays: -21,
  },
  {
    id: 'launch-countdown',
    title: 'Begin the seven-day launch countdown',
    description: 'Prepare and schedule daily countdown content for the final week.',
    group: 'marketing',
    dueOffsetDays: -7,
  },
  {
    id: 'launch-post',
    title: 'Publish launch-day announcement',
    description: 'Publish the launch post only after the opening collection has been checked.',
    group: 'marketing',
    dueOffsetDays: 0,
  },
  {
    id: 'thank-you-follow',
    title: 'Publish Thank You and Follow Our Journey',
    description: 'Acknowledge the launch and continue the brand story after opening.',
    group: 'marketing',
    dueOffsetDays: 1,
  },
]

export const PACKAGING_TASKS: LaunchTaskDefinition[] = [
  {
    id: 'packaging-stock',
    title: 'Packaging supplies stocked',
    description: 'Confirm mailing bags, tissue, tape and protective materials are available.',
    group: 'packaging',
    dueOffsetDays: -30,
  },
  {
    id: 'sku-labels',
    title: 'SKU labels ready',
    description: 'Confirm labels match JOS SKUs and can be applied consistently.',
    group: 'packaging',
    dueOffsetDays: -30,
  },
  {
    id: 'thank-you-cards',
    title: 'Thank-you and review cards ready',
    description: 'Print or order the approved branded customer cards.',
    group: 'packaging',
    dueOffsetDays: -21,
  },
  {
    id: 'storage-map',
    title: 'Storage locations verified',
    description: 'Confirm each launch item can be found quickly from its JOS storage location.',
    group: 'packaging',
    dueOffsetDays: -14,
  },
  {
    id: 'quality-check-test',
    title: 'Final quality-check process tested',
    description: 'Test inspection, flaw recording, measurements and listing evidence.',
    group: 'packaging',
    dueOffsetDays: -14,
  },
  {
    id: 'dispatch-test',
    title: 'Packing and dispatch test completed',
    description: 'Run one full test from sold item through packing, label and dispatch record.',
    group: 'packaging',
    dueOffsetDays: -7,
  },
]

export const LAUNCH_DAY_TASKS: LaunchTaskDefinition[] = [
  {
    id: 'launch-backup',
    title: 'Create verified off-device backup',
    description: 'Export JOS data before opening the first collection.',
    group: 'launch-day',
    dueOffsetDays: 0,
  },
  {
    id: 'launch-finance',
    title: 'Confirm opening cash and reserves',
    description: 'Check recorded business cash, emergency reserve, tax reserve and sourcing controls.',
    group: 'launch-day',
    dueOffsetDays: 0,
  },
  {
    id: 'launch-listings',
    title: 'Upload and verify the opening collection',
    description: 'Check photos, descriptions, measurements, condition and prices before publishing.',
    group: 'launch-day',
    dueOffsetDays: 0,
  },
  {
    id: 'launch-marketing',
    title: 'Publish launch content',
    description: 'Publish the approved launch post and update profile links or information.',
    group: 'launch-day',
    dueOffsetDays: 0,
  },
  {
    id: 'launch-orders',
    title: 'Confirm order and dispatch monitoring',
    description: 'Open JOS orders and prepare to record buyers, deadlines and dispatch evidence.',
    group: 'launch-day',
    dueOffsetDays: 0,
  },
  {
    id: 'launch-review',
    title: 'Complete end-of-day CEO review',
    description: 'Record what launched, what sold, what failed and the next operational priority.',
    group: 'launch-day',
    dueOffsetDays: 0,
  },
]

const DAY_MS = 86_400_000

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function validDate(value?: string): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function launchDateValue(value: string): Date {
  return validDate(`${value}T12:00:00`) ??
    new Date('2027-01-01T12:00:00')
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function dayDifference(from: Date, to: Date): number {
  const fromDay = new Date(from)
  const toDay = new Date(to)
  fromDay.setHours(0, 0, 0, 0)
  toDay.setHours(0, 0, 0, 0)
  return Math.ceil((toDay.getTime() - fromDay.getTime()) / DAY_MS)
}

function taskStates(
  input: unknown,
  definitions: LaunchTaskDefinition[],
): LaunchTaskState[] {
  const records = Array.isArray(input) ? input : []
  const recovered = new Map<string, LaunchTaskState>()
  for (const value of records) {
    if (!isObject(value)) continue
    const id = text(value.id)
    if (!id || !definitions.some(definition => definition.id === id)) continue
    recovered.set(id, {
      id,
      completedAt: text(value.completedAt),
    })
  }
  return definitions.map(definition =>
    recovered.get(definition.id) ?? { id: definition.id },
  )
}

export function createDefaultLaunchCommandSettings(): LaunchCommandSettings {
  return {
    openingStockTarget: 30,
    readyListingTarget: 30,
    priorityBrands: [...DEFAULT_PRIORITY_BRANDS],
    marketingTasks: MARKETING_TASKS.map(task => ({ id: task.id })),
    packagingTasks: PACKAGING_TASKS.map(task => ({ id: task.id })),
    launchDayTasks: LAUNCH_DAY_TASKS.map(task => ({ id: task.id })),
  }
}

export function normaliseLaunchCommandSettings(
  input: unknown,
): LaunchCommandSettings {
  const defaults = createDefaultLaunchCommandSettings()
  if (!isObject(input)) return defaults

  const priorityBrands = Array.isArray(input.priorityBrands)
    ? input.priorityBrands
        .filter((value): value is string => typeof value === 'string')
        .map(value => value.trim())
        .filter(Boolean)
    : defaults.priorityBrands

  return {
    openingStockTarget: Math.max(
      0,
      Math.round(finiteNumber(input.openingStockTarget, defaults.openingStockTarget)),
    ),
    readyListingTarget: Math.max(
      0,
      Math.round(finiteNumber(input.readyListingTarget, defaults.readyListingTarget)),
    ),
    priorityBrands: priorityBrands.length
      ? [...new Set(priorityBrands)]
      : defaults.priorityBrands,
    marketingTasks: taskStates(input.marketingTasks, MARKETING_TASKS),
    packagingTasks: taskStates(input.packagingTasks, PACKAGING_TASKS),
    launchDayTasks: taskStates(input.launchDayTasks, LAUNCH_DAY_TASKS),
    lastReviewedAt: text(input.lastReviewedAt),
  }
}

export function updateLaunchTargets(
  input: LaunchCommandSettings | undefined,
  openingStockTarget: number,
  readyListingTarget: number,
): LaunchCommandSettings {
  const current = normaliseLaunchCommandSettings(input)
  return {
    ...current,
    openingStockTarget: Math.max(0, Math.round(openingStockTarget)),
    readyListingTarget: Math.max(0, Math.round(readyListingTarget)),
  }
}

export function toggleLaunchTask(
  input: LaunchCommandSettings | undefined,
  group: LaunchTaskGroup,
  id: string,
  now = new Date(),
): LaunchCommandSettings {
  const current = normaliseLaunchCommandSettings(input)
  const key =
    group === 'marketing'
      ? 'marketingTasks'
      : group === 'packaging'
        ? 'packagingTasks'
        : 'launchDayTasks'
  return {
    ...current,
    [key]: current[key].map(task =>
      task.id === id
        ? {
            ...task,
            completedAt: task.completedAt ? undefined : now.toISOString(),
          }
        : task,
    ),
  }
}

export function markLaunchCommandReviewed(
  input: LaunchCommandSettings | undefined,
  now = new Date(),
): LaunchCommandSettings {
  return {
    ...normaliseLaunchCommandSettings(input),
    lastReviewedAt: now.toISOString(),
  }
}

export function completeLaunchAutomationReview(
  input: AutomationSettings | undefined,
  now = new Date(),
): AutomationSettings {
  return completeAutomationRule(input, 'weekly-launch-review', now)
}

function taskViews(
  definitions: LaunchTaskDefinition[],
  states: LaunchTaskState[],
  launchDate: Date,
  now: Date,
): LaunchTaskView[] {
  const completedById = new Map(states.map(state => [state.id, state.completedAt]))
  return definitions.map(definition => {
    const completedAt = completedById.get(definition.id)
    const dueDate = addDays(launchDate, definition.dueOffsetDays)
    const remaining = dayDifference(now, dueDate)
    const completed = Boolean(completedAt)
    const status: LaunchTaskStatus =
      completed
        ? 'complete'
        : remaining < 0
          ? 'overdue'
          : remaining === 0
            ? 'due'
            : 'upcoming'
    return {
      ...definition,
      completed,
      completedAt,
      dueDate: isoDate(dueDate),
      status,
      statusLabel:
        status === 'complete'
          ? 'Complete'
          : status === 'overdue'
            ? `${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? '' : 's'} overdue`
            : status === 'due'
              ? 'Due today'
              : `${remaining} days remaining`,
    }
  })
}

function taskProgress(tasks: LaunchTaskView[]): {
  progress: number
  completed: number
  total: number
} {
  const completed = tasks.filter(task => task.completed).length
  return {
    completed,
    total: tasks.length,
    progress: tasks.length ? clamp((completed / tasks.length) * 100) : 100,
  }
}

function progress(value: number, target: number): number {
  if (target <= 0) return 0
  return clamp((value / target) * 100)
}

function phase(daysRemaining: number):
  'foundation' | 'build' | 'countdown' | 'launch-window' | 'past-date' {
  if (daysRemaining < 0) return 'past-date'
  if (daysRemaining <= 1) return 'launch-window'
  if (daysRemaining <= 14) return 'countdown'
  if (daysRemaining <= 60) return 'build'
  return 'foundation'
}

export function calculateLaunchCommandReport(
  items: InventoryItem[],
  orders: OrderRecord[],
  settings: JosSettings,
  now = new Date(),
): LaunchCommandReport {
  const launchSettings = normaliseLaunchCommandSettings(settings.launchCommand)
  const automation = normaliseAutomationSettings(settings.automation)
  const launchDate = launchDateValue(automation.launchDate)
  const daysRemaining = dayDifference(now, launchDate)
  const activeItems = items.filter(item =>
    !['Sold', 'Dispatched', 'Archived'].includes(item.status),
  )
  const eligibleItems = activeItems.filter(item => item.grade !== 'Exit')
  const exitItems = activeItems.filter(item => item.grade === 'Exit')
  const stages = eligibleItems.map(item => ({
    item,
    stage: inferPipelineStage(item),
    readiness: pipelineReadiness(item),
  }))
  const readyItems = stages.filter(({ stage, readiness }) =>
    stage === 'Ready to Upload' ||
    stage === 'Live' ||
    readiness >= 92,
  )
  const liveItems = stages.filter(({ stage }) => stage === 'Live')
  const photoCompleteItems = stages.filter(({ stage }) =>
    ['Photo Review', 'Listing Copy', 'Ready to Upload', 'Live'].includes(stage),
  )
  const listingCopyItems = stages.filter(({ stage }) => stage === 'Listing Copy')
  const photographyItems = stages.filter(({ stage }) =>
    stage === 'Photography' || stage === 'Photo Review',
  )
  const preparationItems = stages.filter(({ stage }) => stage === 'Preparation')
  const averageReadiness = stages.length
    ? stages.reduce((sum, entry) => sum + entry.readiness, 0) / stages.length
    : 0

  const openingTarget = launchSettings.openingStockTarget
  const readyTarget = launchSettings.readyListingTarget
  const stockGap = Math.max(0, openingTarget - eligibleItems.length)
  const readyGap = Math.max(0, readyTarget - readyItems.length)
  const averagePurchaseCost = eligibleItems.length
    ? eligibleItems.reduce((sum, item) => sum + item.purchasePrice, 0) /
      eligibleItems.length
    : 0
  const estimatedGapCost = stockGap * averagePurchaseCost
  const finance = calculateFinanceSummary(settings.finance, items, now)
  const forecast = calculateBusinessForecast(
    items,
    orders,
    settings,
    {
      scenario: 'base',
      horizonWeeks: 12,
      monthlyProfitTarget: settings.monthlyProfitTarget ?? 5000,
    },
    now,
  )
  const forecastSafeSourcingCash = forecast.summary.safeSourcingCapacity
  const affordabilityGap = Math.max(
    0,
    estimatedGapCost - Math.max(
      finance.availableSourcingBudget,
      forecastSafeSourcingCash,
    ),
  )

  const brandCoverage: LaunchBrandCoverage[] =
    launchSettings.priorityBrands.map(brand => {
      const brandItems = eligibleItems.filter(item =>
        item.brand.trim().toLowerCase() === brand.toLowerCase(),
      )
      const readyBrandItems = readyItems.filter(({ item }) =>
        item.brand.trim().toLowerCase() === brand.toLowerCase(),
      )
      return {
        brand,
        activeItems: brandItems.length,
        readyItems: readyBrandItems.length,
        covered: brandItems.length > 0,
      }
    })
  const coveredBrands = brandCoverage.filter(brand => brand.covered).length

  const grades: Record<InventoryItem['grade'], number> = {
    A: 0,
    B: 0,
    C: 0,
    Exit: 0,
  }
  activeItems.forEach(item => {
    grades[item.grade] += 1
  })

  const storageMissing = eligibleItems.filter(item =>
    !item.storageLocation ||
    item.storageLocation.trim().toUpperCase() === 'TBC',
  ).length

  const marketingTasks = taskViews(
    MARKETING_TASKS,
    launchSettings.marketingTasks,
    launchDate,
    now,
  )
  const packagingTasks = taskViews(
    PACKAGING_TASKS,
    launchSettings.packagingTasks,
    launchDate,
    now,
  )
  const launchDayTasks = taskViews(
    LAUNCH_DAY_TASKS,
    launchSettings.launchDayTasks,
    launchDate,
    now,
  )
  const marketingProgress = taskProgress(marketingTasks)
  const packagingProgress = taskProgress(packagingTasks)
  const launchDayProgress = taskProgress(launchDayTasks)

  const coreCompleted = automation.launchChecklist.filter(
    item => Boolean(item.completedAt),
  ).length
  const coreTotal = automation.launchChecklist.length
  const coreProgress = coreTotal
    ? clamp((coreCompleted / coreTotal) * 100)
    : 100
  const brandProgress = launchSettings.priorityBrands.length
    ? clamp((coveredBrands / launchSettings.priorityBrands.length) * 100)
    : 100
  const stockProgress = progress(eligibleItems.length, openingTarget)
  const listingProgress = progress(readyItems.length, readyTarget)
  const overallReadiness = clamp(
    stockProgress * .30 +
    listingProgress * .25 +
    brandProgress * .10 +
    marketingProgress.progress * .15 +
    packagingProgress.progress * .10 +
    coreProgress * .10,
  )

  const blockers: LaunchBlocker[] = []
  if (openingTarget <= 0) {
    blockers.push({
      id: 'set-stock-target',
      title: 'Set the opening-stock target',
      detail: 'Launch stock readiness cannot be measured until a deliberate target is recorded.',
      severity: 'critical',
      destination: 'launch',
      actionLabel: 'Set target',
      priority: 100,
    })
  } else if (stockGap > 0) {
    blockers.push({
      id: 'stock-gap',
      title: `${stockGap} launch-stock ${stockGap === 1 ? 'item' : 'items'} still required`,
      detail: `${eligibleItems.length} of ${openingTarget} launch-eligible items are recorded. Estimated purchase cost for the gap is £${estimatedGapCost.toFixed(2)} based on current average cost.`,
      severity: daysRemaining <= 60 ? 'critical' : 'warning',
      destination: finance.availableSourcingBudget > 0 ? 'sourcecheck' : 'finance',
      actionLabel: finance.availableSourcingBudget > 0 ? 'Open SourceCheck' : 'Open Finance',
      priority: daysRemaining <= 60 ? 98 : 82,
    })
  }
  if (readyTarget <= 0) {
    blockers.push({
      id: 'set-ready-target',
      title: 'Set the listing-ready target',
      detail: 'JOS needs a target for listings ready to upload or already live.',
      severity: 'critical',
      destination: 'launch',
      actionLabel: 'Set target',
      priority: 99,
    })
  } else if (readyGap > 0) {
    blockers.push({
      id: 'listing-gap',
      title: `${readyGap} more listings need to become launch-ready`,
      detail: `${readyItems.length} of ${readyTarget} listings are ready to upload or live.`,
      severity: daysRemaining <= 30 ? 'critical' : 'warning',
      destination: 'pipeline',
      actionLabel: 'Open listing pipeline',
      priority: daysRemaining <= 30 ? 97 : 88,
    })
  }
  if (affordabilityGap > 0 && stockGap > 0) {
    blockers.push({
      id: 'affordability-gap',
      title: 'Recorded sourcing capacity does not cover the estimated stock gap',
      detail: `The estimated gap cost exceeds the stronger of current or forecast safe sourcing cash by £${affordabilityGap.toFixed(2)}.`,
      severity: 'warning',
      destination: 'finance',
      actionLabel: 'Review Finance',
      priority: 90,
    })
  }
  if (exitItems.length > 0) {
    blockers.push({
      id: 'exit-stock',
      title: `${exitItems.length} Exit-stock ${exitItems.length === 1 ? 'item is' : 'items are'} still active`,
      detail: 'Exit stock is excluded from the launch-eligible target and should be cleared, regraded or deliberately retained.',
      severity: 'warning',
      destination: 'inventory',
      actionLabel: 'Review inventory',
      priority: 84,
    })
  }
  if (storageMissing > 0) {
    blockers.push({
      id: 'storage-missing',
      title: `${storageMissing} launch ${storageMissing === 1 ? 'item has' : 'items have'} no confirmed storage location`,
      detail: 'Missing storage locations increase picking and dispatch risk.',
      severity: 'warning',
      destination: 'inventory',
      actionLabel: 'Assign storage',
      priority: 80,
    })
  }
  const overdueMarketing = marketingTasks.filter(task => task.status === 'overdue')
  if (overdueMarketing.length > 0) {
    blockers.push({
      id: 'marketing-overdue',
      title: `${overdueMarketing.length} launch-marketing ${overdueMarketing.length === 1 ? 'task is' : 'tasks are'} overdue`,
      detail: overdueMarketing.slice(0, 3).map(task => task.title).join(' · '),
      severity: 'warning',
      destination: 'launch',
      actionLabel: 'Open campaign plan',
      priority: 86,
    })
  }
  if (daysRemaining <= 45 && packagingProgress.progress < 100) {
    blockers.push({
      id: 'packaging-incomplete',
      title: `${packagingProgress.total - packagingProgress.completed} packaging checks remain`,
      detail: 'Packaging, SKU labels, storage and dispatch testing should be completed before the launch window.',
      severity: daysRemaining <= 14 ? 'critical' : 'warning',
      destination: 'launch',
      actionLabel: 'Open operations checks',
      priority: daysRemaining <= 14 ? 96 : 78,
    })
  }
  if (daysRemaining <= 60 && coreProgress < 100) {
    blockers.push({
      id: 'core-checklist',
      title: `${coreTotal - coreCompleted} foundation launch checks remain`,
      detail: 'The Automation Centre checklist still contains unconfirmed business setup, stock, marketing or backup preparation.',
      severity: daysRemaining <= 30 ? 'critical' : 'warning',
      destination: 'automation',
      actionLabel: 'Open Automation Centre',
      priority: daysRemaining <= 30 ? 95 : 76,
    })
  }
  if (daysRemaining <= 7 && launchDayProgress.progress < 100) {
    blockers.push({
      id: 'launch-day-control',
      title: `${launchDayProgress.total - launchDayProgress.completed} launch-day controls remain`,
      detail: 'Backup, finance, listings, marketing, orders and CEO review must be controlled during the launch window.',
      severity: 'critical',
      destination: 'launch',
      actionLabel: 'Open launch-day control',
      priority: 100,
    })
  }

  blockers.sort((a, b) => b.priority - a.priority)

  return {
    generatedAt: now.toISOString(),
    launchDate: automation.launchDate,
    daysRemaining,
    phase: phase(daysRemaining),
    overallReadiness,
    readinessLabel:
      overallReadiness >= 90
        ? 'Launch-ready'
        : overallReadiness >= 70
          ? 'On track'
          : overallReadiness >= 45
            ? 'Work required'
            : 'At risk',
    stock: {
      target: openingTarget,
      eligibleItems: eligibleItems.length,
      allActiveItems: activeItems.length,
      exitItems: exitItems.length,
      progress: stockProgress,
      gap: stockGap,
      averagePurchaseCost,
      estimatedGapCost,
      currentSafeSourcingCash: finance.availableSourcingBudget,
      forecastSafeSourcingCash,
      affordabilityGap,
    },
    listings: {
      target: readyTarget,
      readyItems: readyItems.length,
      liveItems: liveItems.length,
      photoCompleteItems: photoCompleteItems.length,
      listingCopyItems: listingCopyItems.length,
      photographyItems: photographyItems.length,
      preparationItems: preparationItems.length,
      progress: listingProgress,
      gap: readyGap,
      averageReadiness,
    },
    brands: {
      priorityBrands: launchSettings.priorityBrands.length,
      coveredBrands,
      progress: brandProgress,
      coverage: brandCoverage,
    },
    grades,
    storageMissing,
    marketing: {
      ...marketingProgress,
      overdue: overdueMarketing.length,
      tasks: marketingTasks,
    },
    packaging: {
      ...packagingProgress,
      tasks: packagingTasks,
    },
    launchDay: {
      ...launchDayProgress,
      tasks: launchDayTasks,
    },
    coreChecklist: {
      progress: coreProgress,
      completed: coreCompleted,
      total: coreTotal,
    },
    blockers,
    nextActions: blockers.slice(0, 6),
    evidence: {
      inventoryItemsUsed: activeItems.length,
      eligibleItemsUsed: eligibleItems.length,
      itemsWithPipelineData: eligibleItems.filter(item =>
        Boolean(item.pipelineStage || item.photoChecklist || item.listingChecklist),
      ).length,
      priorityBrandRecords: brandCoverage.reduce(
        (sum, brand) => sum + brand.activeItems,
        0,
      ),
      financeCashBalance: finance.cashBalance,
      forecastConfidence: forecast.confidenceScore,
      launchReviewLastCompletedAt: automation.rules.find(
        rule => rule.id === 'weekly-launch-review',
      )?.lastCompletedAt,
      commandReviewLastCompletedAt: launchSettings.lastReviewedAt,
    },
    assumptions: [
      'The default opening-stock and ready-listing targets are editable planning values, not a universal recommendation.',
      'Exit-grade stock is excluded from launch-eligible stock until it is regraded or deliberately retained.',
      'Ready listings are items at Ready to Upload, Live or at least 92% pipeline readiness.',
      'Estimated stock-gap cost uses the average purchase cost of current launch-eligible stock.',
      'Priority-brand coverage measures whether each approved target brand is represented; it does not prove demand.',
      'Marketing, packaging and launch-day tasks require manual confirmation.',
      'Overall readiness is weighted across stock, listings, brand coverage, marketing, packaging and the Automation Centre foundation checklist.',
      'The command centre never publishes posts, uploads listings, sources stock or changes inventory automatically.',
    ],
  }
}
