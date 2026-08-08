import type {
  AutomationHistoryEntry,
  AutomationRuleId,
  AutomationRuleState,
  AutomationSettings,
  InventoryItem,
  JosSettings,
  OrderRecord,
} from '../types/inventory.ts'
import { calculateCeoRecommendations } from './ceoRecommendations.ts'
import { calculateFinanceSummary, normaliseFinanceState } from './finance.ts'
import { calculateInventoryIntelligence } from './inventoryIntelligence.ts'

export type AutomationCadence = 'daily' | 'weekly'
export type AutomationStatus = 'due' | 'overdue' | 'upcoming' | 'snoozed' | 'disabled'
export type AutomationSeverity = 'critical' | 'warning' | 'information' | 'positive'
export type AutomationDestination =
  | 'recommendations'
  | 'backup'
  | 'inventory-intelligence'
  | 'finance'
  | 'launch'

export type AutomationRuntimeEvidence = {
  latestAutoBackupAt?: string
  lastOffDeviceExportAt?: string
}

export type AutomationRuleDefinition = {
  id: AutomationRuleId
  title: string
  description: string
  cadence: AutomationCadence
  cadenceDays: number
  destination: AutomationDestination
  actionLabel: string
  defaultEnabled: boolean
}

export type LaunchChecklistDefinition = {
  id: string
  title: string
  description: string
}

export type AutomationRuleView = {
  id: AutomationRuleId
  title: string
  description: string
  cadence: AutomationCadence
  cadenceLabel: string
  destination: AutomationDestination
  actionLabel: string
  enabled: boolean
  status: AutomationStatus
  statusLabel: string
  dueAt: string
  lastCompletedAt?: string
  snoozedUntil?: string
  overdueDays: number
  priority: number
  severity: AutomationSeverity
  dynamicDetail: string
  evidence: string[]
}

export type AutomationAlert = {
  id: string
  title: string
  detail: string
  severity: AutomationSeverity
  destination: AutomationDestination
  actionLabel: string
}

export type LaunchReadiness = {
  launchDate: string
  daysRemaining: number
  completed: number
  total: number
  progress: number
  status: 'planning' | 'approaching' | 'launch-window' | 'past-date'
  items: Array<LaunchChecklistDefinition & {
    completed: boolean
    completedAt?: string
  }>
}

export type AutomationReport = {
  generatedAt: string
  rules: AutomationRuleView[]
  dueRules: AutomationRuleView[]
  upcomingRules: AutomationRuleView[]
  alerts: AutomationAlert[]
  dueCount: number
  overdueCount: number
  snoozedCount: number
  completedLast7Days: number
  latestBackupAgeDays?: number
  offDeviceExportAgeDays?: number
  launch: LaunchReadiness
  evidence: {
    todayRecommendations: number
    customerCommitments: number
    ageingItems: number
    ageingCash: number
    financeTransactionsLast7Days: number
    taxReserveShortfall: number
    inventoryDataQuality: number
  }
  limitations: string[]
}

export const AUTOMATION_RULE_DEFINITIONS: AutomationRuleDefinition[] = [
  {
    id: 'daily-ceo-review',
    title: 'Complete the daily CEO review',
    description: 'Open the ranked decision plan and confirm the highest-impact work for today.',
    cadence: 'daily',
    cadenceDays: 1,
    destination: 'recommendations',
    actionLabel: 'Open CEO plan',
    defaultEnabled: true,
  },
  {
    id: 'weekly-backup-check',
    title: 'Verify business backups',
    description: 'Confirm the latest automatic snapshot and create an off-device export regularly.',
    cadence: 'weekly',
    cadenceDays: 7,
    destination: 'backup',
    actionLabel: 'Open Backup Centre',
    defaultEnabled: true,
  },
  {
    id: 'weekly-ageing-review',
    title: 'Review ageing and Exit stock',
    description: 'Check live stock aged 60 days or more and decide whether price, listing or exit action is needed.',
    cadence: 'weekly',
    cadenceDays: 7,
    destination: 'inventory-intelligence',
    actionLabel: 'Open stock intelligence',
    defaultEnabled: true,
  },
  {
    id: 'weekly-finance-check',
    title: 'Complete the weekly finance review',
    description: 'Reconcile recent sales and expenses, check reserves and confirm safe sourcing cash.',
    cadence: 'weekly',
    cadenceDays: 7,
    destination: 'finance',
    actionLabel: 'Open Finance',
    defaultEnabled: true,
  },
  {
    id: 'weekly-launch-review',
    title: 'Review January 2027 launch readiness',
    description: 'Update the launch checklist and resolve the next incomplete preparation task.',
    cadence: 'weekly',
    cadenceDays: 7,
    destination: 'launch',
    actionLabel: 'Open launch checklist',
    defaultEnabled: true,
  },
]

export const LAUNCH_CHECKLIST_DEFINITIONS: LaunchChecklistDefinition[] = [
  {
    id: 'launch-target',
    title: 'Confirm launch stock target',
    description: 'Set the number and mix of items required for the first January collection.',
  },
  {
    id: 'business-setup',
    title: 'Confirm sole-trader and tax setup',
    description: 'Record the final HMRC and operating setup required before trading.',
  },
  {
    id: 'banking-bookkeeping',
    title: 'Confirm banking and bookkeeping workflow',
    description: 'Decide how business cash, expenses, tax reserves and records will be maintained.',
  },
  {
    id: 'launch-stock',
    title: 'Prepare the launch stock collection',
    description: 'Source, inspect, grade and store the planned opening collection.',
  },
  {
    id: 'listing-system',
    title: 'Complete photography and listing workflow',
    description: 'Test the full process from preparation through ready-to-upload listings.',
  },
  {
    id: 'marketing-schedule',
    title: 'Complete the launch marketing schedule',
    description: 'Finish the January social content, countdown and launch-day posts.',
  },
  {
    id: 'packaging-dispatch',
    title: 'Test packaging and dispatch',
    description: 'Confirm packaging supplies, labels, storage picking and dispatch routines.',
  },
  {
    id: 'off-device-backup',
    title: 'Create an off-device JOS backup',
    description: 'Export a verified backup before the January launch.',
  },
]

const DAY_MS = 86_400_000
const DEFAULT_LAUNCH_DATE = '2027-01-01'

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function validDate(value?: string): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function ageDays(value: string | undefined, now: Date): number | undefined {
  const date = validDate(value)
  if (!date) return undefined
  return Math.max(0, (now.getTime() - date.getTime()) / DAY_MS)
}

function ruleId(value: unknown): AutomationRuleId | undefined {
  return AUTOMATION_RULE_DEFINITIONS.some(definition => definition.id === value)
    ? value as AutomationRuleId
    : undefined
}

function checklistId(value: unknown): string | undefined {
  return LAUNCH_CHECKLIST_DEFINITIONS.some(definition => definition.id === value)
    ? value as string
    : undefined
}

export function createDefaultAutomationSettings(): AutomationSettings {
  return {
    rules: AUTOMATION_RULE_DEFINITIONS.map(definition => ({
      id: definition.id,
      enabled: definition.defaultEnabled,
    })),
    launchDate: DEFAULT_LAUNCH_DATE,
    launchChecklist: LAUNCH_CHECKLIST_DEFINITIONS.map(item => ({ id: item.id })),
    history: [],
  }
}

export function normaliseAutomationSettings(input: unknown): AutomationSettings {
  const defaults = createDefaultAutomationSettings()
  if (!isObject(input)) return defaults

  const rawRules = Array.isArray(input.rules) ? input.rules : []
  const rulesById = new Map<AutomationRuleId, AutomationRuleState>()
  for (const value of rawRules) {
    if (!isObject(value)) continue
    const id = ruleId(value.id)
    if (!id) continue
    rulesById.set(id, {
      id,
      enabled: value.enabled !== false,
      lastCompletedAt: text(value.lastCompletedAt),
      snoozedUntil: text(value.snoozedUntil),
    })
  }

  const rawChecklist = Array.isArray(input.launchChecklist)
    ? input.launchChecklist
    : []
  const checklistById = new Map<string, { id: string; completedAt?: string }>()
  for (const value of rawChecklist) {
    if (!isObject(value)) continue
    const id = checklistId(value.id)
    if (!id) continue
    checklistById.set(id, {
      id,
      completedAt: text(value.completedAt),
    })
  }

  const history: AutomationHistoryEntry[] = Array.isArray(input.history)
    ? input.history
        .filter(isObject)
        .map((value, index) => {
          const id = ruleId(value.ruleId)
          const completedAt = text(value.completedAt)
          if (!id || !completedAt) return undefined
          return {
            id: text(value.id) ?? `migrated-${id}-${index + 1}`,
            ruleId: id,
            completedAt,
          }
        })
        .filter((entry): entry is AutomationHistoryEntry => Boolean(entry))
        .slice(0, 100)
    : []

  const recoveredLaunchDate = text(input.launchDate)
  const launchDate = recoveredLaunchDate && /^\d{4}-\d{2}-\d{2}$/.test(recoveredLaunchDate)
    ? recoveredLaunchDate
    : DEFAULT_LAUNCH_DATE

  return {
    rules: AUTOMATION_RULE_DEFINITIONS.map(definition =>
      rulesById.get(definition.id) ?? {
        id: definition.id,
        enabled: definition.defaultEnabled,
      },
    ),
    launchDate,
    launchChecklist: LAUNCH_CHECKLIST_DEFINITIONS.map(item =>
      checklistById.get(item.id) ?? { id: item.id },
    ),
    history,
  }
}

export function completeAutomationRule(
  input: AutomationSettings | undefined,
  id: AutomationRuleId,
  now = new Date(),
): AutomationSettings {
  const current = normaliseAutomationSettings(input)
  const completedAt = now.toISOString()
  return {
    ...current,
    rules: current.rules.map(rule =>
      rule.id === id
        ? {
            ...rule,
            enabled: true,
            lastCompletedAt: completedAt,
            snoozedUntil: undefined,
          }
        : rule,
    ),
    history: [
      {
        id: `${id}-${completedAt}`,
        ruleId: id,
        completedAt,
      },
      ...current.history,
    ].slice(0, 100),
  }
}

export function snoozeAutomationRule(
  input: AutomationSettings | undefined,
  id: AutomationRuleId,
  days = 1,
  now = new Date(),
): AutomationSettings {
  const current = normaliseAutomationSettings(input)
  const snoozedUntil = addDays(now, Math.max(1, days)).toISOString()
  return {
    ...current,
    rules: current.rules.map(rule =>
      rule.id === id
        ? { ...rule, enabled: true, snoozedUntil }
        : rule,
    ),
  }
}

export function setAutomationRuleEnabled(
  input: AutomationSettings | undefined,
  id: AutomationRuleId,
  enabled: boolean,
): AutomationSettings {
  const current = normaliseAutomationSettings(input)
  return {
    ...current,
    rules: current.rules.map(rule =>
      rule.id === id
        ? { ...rule, enabled, snoozedUntil: enabled ? rule.snoozedUntil : undefined }
        : rule,
    ),
  }
}

export function toggleLaunchChecklistItem(
  input: AutomationSettings | undefined,
  id: string,
  now = new Date(),
): AutomationSettings {
  const current = normaliseAutomationSettings(input)
  if (!LAUNCH_CHECKLIST_DEFINITIONS.some(item => item.id === id)) return current
  return {
    ...current,
    launchChecklist: current.launchChecklist.map(item =>
      item.id === id
        ? {
            ...item,
            completedAt: item.completedAt ? undefined : now.toISOString(),
          }
        : item,
    ),
  }
}

export function setAutomationLaunchDate(
  input: AutomationSettings | undefined,
  launchDate: string,
): AutomationSettings {
  const current = normaliseAutomationSettings(input)
  return {
    ...current,
    launchDate: launchDate || DEFAULT_LAUNCH_DATE,
  }
}

function nextDueDate(
  rule: AutomationRuleState,
  definition: AutomationRuleDefinition,
  now: Date,
): Date {
  const completed = validDate(rule.lastCompletedAt)
  if (!completed) return startOfDay(now)
  return startOfDay(addDays(completed, definition.cadenceDays))
}

function statusFor(
  rule: AutomationRuleState,
  definition: AutomationRuleDefinition,
  now: Date,
): {
  status: AutomationStatus
  dueAt: Date
  overdueDays: number
} {
  const dueAt = nextDueDate(rule, definition, now)
  if (!rule.enabled) return { status: 'disabled', dueAt, overdueDays: 0 }

  const snoozed = validDate(rule.snoozedUntil)
  if (snoozed && snoozed > now) {
    return { status: 'snoozed', dueAt: snoozed, overdueDays: 0 }
  }

  const today = startOfDay(now)
  const overdueDays = Math.max(
    0,
    Math.floor((today.getTime() - dueAt.getTime()) / DAY_MS),
  )
  if (dueAt < today) return { status: 'overdue', dueAt, overdueDays }
  if (dueAt.getTime() === today.getTime()) {
    return { status: 'due', dueAt, overdueDays: 0 }
  }
  return { status: 'upcoming', dueAt, overdueDays: 0 }
}

function statusLabel(status: AutomationStatus, overdueDays: number): string {
  if (status === 'overdue') return `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`
  if (status === 'due') return 'Due today'
  if (status === 'snoozed') return 'Snoozed'
  if (status === 'disabled') return 'Disabled'
  return 'Upcoming'
}

function recentFinanceTransactions(settings: JosSettings, now: Date): number {
  const finance = normaliseFinanceState(settings.finance)
  const start = addDays(now, -7)
  return finance.transactions.filter(transaction => {
    const date = validDate(`${transaction.date}T12:00:00`)
    return Boolean(date && date >= start && date <= now)
  }).length
}

function launchReadiness(
  automation: AutomationSettings,
  now: Date,
): LaunchReadiness {
  const launchDate = validDate(`${automation.launchDate}T12:00:00`) ??
    validDate(`${DEFAULT_LAUNCH_DATE}T12:00:00`) as Date
  const today = startOfDay(now)
  const launchDay = startOfDay(launchDate)
  const daysRemaining = Math.ceil(
    (launchDay.getTime() - today.getTime()) / DAY_MS,
  )
  const completedById = new Map(
    automation.launchChecklist.map(item => [item.id, item.completedAt]),
  )
  const items = LAUNCH_CHECKLIST_DEFINITIONS.map(item => ({
    ...item,
    completed: Boolean(completedById.get(item.id)),
    completedAt: completedById.get(item.id),
  }))
  const completed = items.filter(item => item.completed).length
  const progress = items.length
    ? Math.round((completed / items.length) * 100)
    : 100

  return {
    launchDate: automation.launchDate,
    daysRemaining,
    completed,
    total: items.length,
    progress,
    status:
      daysRemaining < 0
        ? 'past-date'
        : daysRemaining <= 7
          ? 'launch-window'
          : daysRemaining <= 30
            ? 'approaching'
            : 'planning',
    items,
  }
}

export function calculateAutomationReport(
  items: InventoryItem[],
  orders: OrderRecord[],
  settings: JosSettings,
  runtime: AutomationRuntimeEvidence = {},
  now = new Date(),
): AutomationReport {
  const automation = normaliseAutomationSettings(settings.automation)
  const recommendations = calculateCeoRecommendations(items, orders, settings, now)
  const inventory = calculateInventoryIntelligence(items, settings.finance, now)
  const finance = calculateFinanceSummary(settings.finance, items, now)
  const launch = launchReadiness(automation, now)
  const financeTransactionsLast7Days = recentFinanceTransactions(settings, now)
  const ageingItems = inventory.items.filter(entry =>
    entry.item.status === 'Live' &&
    entry.ageDays !== undefined &&
    entry.ageDays >= 60,
  )
  const ageingCash = ageingItems.reduce(
    (sum, entry) => sum + entry.cashLocked,
    0,
  )
  const latestBackupAgeDays = ageDays(runtime.latestAutoBackupAt, now)
  const offDeviceExportAgeDays = ageDays(runtime.lastOffDeviceExportAt, now)

  const dynamic: Record<AutomationRuleId, {
    detail: string
    evidence: string[]
    severity: AutomationSeverity
    priority: number
  }> = {
    'daily-ceo-review': {
      detail: recommendations.todayPlan.length
        ? `${recommendations.todayPlan.length} ranked actions require review; the highest priority is “${recommendations.todayPlan[0].title}”.`
        : 'No immediate customer, stock, cash or finance action is currently ranked.',
      evidence: [
        `${recommendations.todayPlan.length} actions in today’s plan`,
        `${recommendations.decisionConfidenceScore}/100 decision confidence`,
      ],
      severity: recommendations.todayPlan.some(item => item.urgency === 'critical')
        ? 'critical'
        : 'information',
      priority: recommendations.todayPlan.some(item => item.urgency === 'critical')
        ? 100
        : 75,
    },
    'weekly-backup-check': {
      detail: latestBackupAgeDays === undefined
        ? 'No automatic backup snapshot is available.'
        : `Latest automatic snapshot is ${latestBackupAgeDays.toFixed(1)} days old; ${
            offDeviceExportAgeDays === undefined
              ? 'no off-device export is recorded'
              : `the off-device export is ${offDeviceExportAgeDays.toFixed(1)} days old`
          }.`,
      evidence: [
        latestBackupAgeDays === undefined
          ? 'No automatic snapshot'
          : `${latestBackupAgeDays.toFixed(1)} days since automatic snapshot`,
        offDeviceExportAgeDays === undefined
          ? 'No off-device export recorded'
          : `${offDeviceExportAgeDays.toFixed(1)} days since off-device export`,
      ],
      severity:
        latestBackupAgeDays === undefined ||
        (latestBackupAgeDays ?? 0) > 1 ||
        offDeviceExportAgeDays === undefined ||
        (offDeviceExportAgeDays ?? 0) >= 7
          ? 'warning'
          : 'positive',
      priority:
        latestBackupAgeDays === undefined || (latestBackupAgeDays ?? 0) > 1
          ? 95
          : 70,
    },
    'weekly-ageing-review': {
      detail: ageingItems.length
        ? `${ageingItems.length} live item${ageingItems.length === 1 ? '' : 's'} aged 60+ days hold £${ageingCash.toFixed(2)} of purchase cash.`
        : 'No live inventory with a recorded age of 60 days or more currently needs review.',
      evidence: [
        `${ageingItems.length} ageing live items`,
        `£${ageingCash.toFixed(2)} purchase cash under review`,
      ],
      severity: ageingItems.length ? 'warning' : 'positive',
      priority: ageingItems.length ? 88 : 55,
    },
    'weekly-finance-check': {
      detail: `${financeTransactionsLast7Days} finance entries were recorded in the last seven days${
        finance.additionalTaxReserveNeeded > 0
          ? `; the planning tax reserve is short by £${finance.additionalTaxReserveNeeded.toFixed(2)}`
          : '; no planning tax-reserve shortfall is currently shown'
      }.`,
      evidence: [
        `${financeTransactionsLast7Days} finance entries in seven days`,
        `£${finance.cashBalance.toFixed(2)} recorded cash`,
        `£${finance.additionalTaxReserveNeeded.toFixed(2)} tax-reserve shortfall`,
      ],
      severity: finance.additionalTaxReserveNeeded > 0
        ? 'warning'
        : financeTransactionsLast7Days === 0
          ? 'information'
          : 'positive',
      priority: finance.additionalTaxReserveNeeded > 0 ? 90 : 65,
    },
    'weekly-launch-review': {
      detail: `${launch.completed} of ${launch.total} launch checks are complete; ${
        launch.daysRemaining >= 0
          ? `${launch.daysRemaining} days remain`
          : `the planned launch date passed ${Math.abs(launch.daysRemaining)} days ago`
      }.`,
      evidence: [
        `${launch.progress}% launch readiness`,
        `${launch.completed}/${launch.total} checklist items complete`,
        `${launch.daysRemaining} days to planned launch`,
      ],
      severity:
        launch.daysRemaining <= 30 && launch.progress < 100
          ? 'warning'
          : launch.progress === 100
            ? 'positive'
            : 'information',
      priority:
        launch.daysRemaining <= 30 && launch.progress < 100
          ? 92
          : 60,
    },
  }

  const rules: AutomationRuleView[] = AUTOMATION_RULE_DEFINITIONS.map(definition => {
    const state = automation.rules.find(rule => rule.id === definition.id) ?? {
      id: definition.id,
      enabled: definition.defaultEnabled,
    }
    const schedule = statusFor(state, definition, now)
    const statusPriority =
      schedule.status === 'overdue'
        ? 40 + Math.min(20, schedule.overdueDays)
        : schedule.status === 'due'
          ? 25
          : 0

    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      cadence: definition.cadence,
      cadenceLabel: definition.cadence === 'daily' ? 'Every day' : 'Every 7 days',
      destination: definition.destination,
      actionLabel: definition.actionLabel,
      enabled: state.enabled,
      status: schedule.status,
      statusLabel: statusLabel(schedule.status, schedule.overdueDays),
      dueAt: schedule.dueAt.toISOString(),
      lastCompletedAt: state.lastCompletedAt,
      snoozedUntil: state.snoozedUntil,
      overdueDays: schedule.overdueDays,
      priority: dynamic[definition.id].priority + statusPriority,
      severity: dynamic[definition.id].severity,
      dynamicDetail: dynamic[definition.id].detail,
      evidence: dynamic[definition.id].evidence,
    }
  }).sort((a, b) => b.priority - a.priority)

  const alerts: AutomationAlert[] = []
  const customerCommitments = recommendations.todayPlan.filter(
    item => item.category === 'customer',
  ).length
  if (customerCommitments > 0) {
    alerts.push({
      id: 'customer-commitments',
      title: `${customerCommitments} customer commitment${customerCommitments === 1 ? '' : 's'} require action`,
      detail: 'Customer obligations outrank routine automation checks.',
      severity: 'critical',
      destination: 'recommendations',
      actionLabel: 'Open CEO plan',
    })
  }
  if (latestBackupAgeDays === undefined) {
    alerts.push({
      id: 'no-backup',
      title: 'No automatic backup is available',
      detail: 'Create a verified snapshot before making further structural changes.',
      severity: 'critical',
      destination: 'backup',
      actionLabel: 'Open Backup Centre',
    })
  } else if (latestBackupAgeDays > 1) {
    alerts.push({
      id: 'stale-backup',
      title: 'Automatic backup needs attention',
      detail: `The latest snapshot is ${latestBackupAgeDays.toFixed(1)} days old.`,
      severity: 'warning',
      destination: 'backup',
      actionLabel: 'Open Backup Centre',
    })
  }
  if (
    offDeviceExportAgeDays === undefined ||
    offDeviceExportAgeDays >= 7
  ) {
    alerts.push({
      id: 'off-device-backup',
      title: 'Off-device export is due',
      detail: offDeviceExportAgeDays === undefined
        ? 'No off-device backup export is recorded.'
        : `The last off-device export is ${offDeviceExportAgeDays.toFixed(1)} days old.`,
      severity: 'warning',
      destination: 'backup',
      actionLabel: 'Export backup',
    })
  }
  if (ageingItems.length > 0) {
    alerts.push({
      id: 'ageing-stock',
      title: `${ageingItems.length} ageing live item${ageingItems.length === 1 ? '' : 's'}`,
      detail: `£${ageingCash.toFixed(2)} of purchase cash requires review.`,
      severity: 'warning',
      destination: 'inventory-intelligence',
      actionLabel: 'Review ageing stock',
    })
  }
  if (finance.additionalTaxReserveNeeded > 0) {
    alerts.push({
      id: 'tax-reserve',
      title: 'Planning tax reserve needs attention',
      detail: `The current planning shortfall is £${finance.additionalTaxReserveNeeded.toFixed(2)}.`,
      severity: 'warning',
      destination: 'finance',
      actionLabel: 'Open Finance',
    })
  }
  if (launch.daysRemaining <= 30 && launch.progress < 100) {
    alerts.push({
      id: 'launch-readiness',
      title: 'Launch-readiness deadline is approaching',
      detail: `${launch.daysRemaining} days remain and ${launch.total - launch.completed} checklist items are incomplete.`,
      severity: 'warning',
      destination: 'launch',
      actionLabel: 'Open launch checklist',
    })
  }

  const sevenDaysAgo = addDays(now, -7)
  const completedLast7Days = automation.history.filter(entry => {
    const date = validDate(entry.completedAt)
    return Boolean(date && date >= sevenDaysAgo && date <= now)
  }).length

  const dueRules = rules.filter(rule =>
    rule.status === 'due' || rule.status === 'overdue',
  )
  const upcomingRules = rules.filter(rule =>
    rule.status === 'upcoming' || rule.status === 'snoozed',
  )

  return {
    generatedAt: now.toISOString(),
    rules,
    dueRules,
    upcomingRules,
    alerts,
    dueCount: rules.filter(rule => rule.status === 'due').length,
    overdueCount: rules.filter(rule => rule.status === 'overdue').length,
    snoozedCount: rules.filter(rule => rule.status === 'snoozed').length,
    completedLast7Days,
    latestBackupAgeDays,
    offDeviceExportAgeDays,
    launch,
    evidence: {
      todayRecommendations: recommendations.todayPlan.length,
      customerCommitments,
      ageingItems: ageingItems.length,
      ageingCash,
      financeTransactionsLast7Days,
      taxReserveShortfall: finance.additionalTaxReserveNeeded,
      inventoryDataQuality: inventory.dataQuality.score,
    },
    limitations: [
      'Automation checks run when JOS One is opened or its saved data changes.',
      'This release does not run background jobs or send notifications while the browser is closed.',
      'Completing a routine records that the review was performed; it does not automatically edit business records.',
      'Snoozing postpones the reminder only and does not remove the underlying business issue.',
      'Launch checklist completion is manual and should only be marked after the work is genuinely finished.',
      'Automatic snapshots remain on this device; an off-device export is still required for stronger protection.',
    ],
  }
}
