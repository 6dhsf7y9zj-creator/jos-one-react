import { describe, expect, it } from 'vitest'
import type {
  InventoryItem,
  JosSettings,
} from '../types/inventory.ts'
import {
  calculateAutomationReport,
  completeAutomationRule,
  createDefaultAutomationSettings,
  normaliseAutomationSettings,
  setAutomationRuleEnabled,
  snoozeAutomationRule,
  toggleLaunchChecklistItem,
} from './automationCentre.ts'

const settings = (): JosSettings => ({
  minimumProfit: 15,
  targetRoi: 150,
  monthlyProfitTarget: 5000,
  storageLocations: ['A1'],
  automation: createDefaultAutomationSettings(),
  finance: {
    openingCash: 0,
    emergencyReserve: 0,
    plannedSourcingBudget: 0,
    taxPlanningRate: 20,
    transactions: [],
  },
})

const item = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  sku: 'JAE-001',
  brand: 'Nike',
  category: 'Hoodie',
  description: 'Nike hoodie',
  size: 'M',
  condition: 'Very Good',
  status: 'Live',
  grade: 'B',
  purchasePrice: 10,
  expectedSalePrice: 35,
  storageLocation: 'A1',
  dateListed: '2026-07-01',
  ...overrides,
})

describe('Automation Centre engine', () => {
  it('normalises old settings into all built-in routines', () => {
    const automation = normaliseAutomationSettings(undefined)
    expect(automation.rules).toHaveLength(5)
    expect(automation.launchChecklist).toHaveLength(8)
    expect(automation.launchDate).toBe('2027-01-01')
  })

  it('shows never-completed enabled routines as due today', () => {
    const report = calculateAutomationReport(
      [],
      [],
      settings(),
      {},
      new Date('2026-08-02T18:00:00'),
    )
    expect(report.dueRules).toHaveLength(5)
    expect(report.overdueCount).toBe(0)
  })

  it('moves a completed daily review to its next due date', () => {
    const businessSettings = settings()
    businessSettings.automation = completeAutomationRule(
      businessSettings.automation,
      'daily-ceo-review',
      new Date('2026-08-02T18:00:00'),
    )
    const report = calculateAutomationReport(
      [],
      [],
      businessSettings,
      {},
      new Date('2026-08-02T19:00:00'),
    )
    const rule = report.rules.find(item => item.id === 'daily-ceo-review')
    expect(rule?.status).toBe('upcoming')
  })

  it('supports snoozing and disabling without deleting history', () => {
    let automation = createDefaultAutomationSettings()
    automation = completeAutomationRule(
      automation,
      'weekly-finance-check',
      new Date('2026-08-01T12:00:00'),
    )
    automation = snoozeAutomationRule(
      automation,
      'weekly-finance-check',
      2,
      new Date('2026-08-02T12:00:00'),
    )
    automation = setAutomationRuleEnabled(
      automation,
      'weekly-ageing-review',
      false,
    )
    const businessSettings = settings()
    businessSettings.automation = automation
    const report = calculateAutomationReport(
      [],
      [],
      businessSettings,
      {},
      new Date('2026-08-02T18:00:00'),
    )
    expect(report.rules.find(item => item.id === 'weekly-finance-check')?.status).toBe('snoozed')
    expect(report.rules.find(item => item.id === 'weekly-ageing-review')?.status).toBe('disabled')
    expect(automation.history).toHaveLength(1)
  })

  it('raises backup and ageing-stock alerts from recorded evidence', () => {
    const report = calculateAutomationReport(
      [item({ dateListed: '2026-04-01' })],
      [],
      settings(),
      {},
      new Date('2026-08-02T18:00:00'),
    )
    expect(report.alerts.some(alert => alert.id === 'no-backup')).toBe(true)
    expect(report.alerts.some(alert => alert.id === 'ageing-stock')).toBe(true)
    expect(report.evidence.ageingCash).toBe(10)
  })

  it('tracks launch checklist progress and countdown', () => {
    const businessSettings = settings()
    businessSettings.automation = toggleLaunchChecklistItem(
      businessSettings.automation,
      'launch-target',
      new Date('2026-08-02T18:00:00'),
    )
    const report = calculateAutomationReport(
      [],
      [],
      businessSettings,
      {},
      new Date('2026-08-02T18:00:00'),
    )
    expect(report.launch.completed).toBe(1)
    expect(report.launch.total).toBe(8)
    expect(report.launch.daysRemaining).toBeGreaterThan(0)
  })

  it('does not mutate supplied settings or inventory', () => {
    const items = [item()]
    const businessSettings = settings()
    const itemsBefore = JSON.stringify(items)
    const settingsBefore = JSON.stringify(businessSettings)
    calculateAutomationReport(items, [], businessSettings)
    expect(JSON.stringify(items)).toBe(itemsBefore)
    expect(JSON.stringify(businessSettings)).toBe(settingsBefore)
  })
})
