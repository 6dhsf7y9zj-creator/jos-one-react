import { describe, expect, it } from 'vitest'
import type {
  InventoryItem,
  JosSettings,
} from '../types/inventory.ts'
import {
  calculateLaunchCommandReport,
  createDefaultLaunchCommandSettings,
  normaliseLaunchCommandSettings,
  toggleLaunchTask,
  updateLaunchTargets,
} from './launchCommand.ts'
import { createDefaultAutomationSettings } from './automationCentre.ts'

const item = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  sku: 'JAE-001',
  brand: 'Nike',
  category: 'Hoodie',
  description: 'Nike hoodie',
  size: 'M',
  condition: 'Very Good',
  status: 'Photographed',
  grade: 'A',
  purchasePrice: 10,
  expectedSalePrice: 35,
  storageLocation: 'A1',
  pipelineStage: 'Ready to Upload',
  ...overrides,
})

const settings = (): JosSettings => ({
  minimumProfit: 15,
  targetRoi: 150,
  monthlyProfitTarget: 5000,
  storageLocations: ['A1'],
  automation: createDefaultAutomationSettings(),
  launchCommand: createDefaultLaunchCommandSettings(),
  finance: {
    openingCash: 100,
    emergencyReserve: 0,
    plannedSourcingBudget: 100,
    taxPlanningRate: 20,
    transactions: [],
  },
})

describe('Launch Command Centre engine', () => {
  it('normalises old settings into all launch task groups', () => {
    const launch = normaliseLaunchCommandSettings(undefined)
    expect(launch.marketingTasks).toHaveLength(10)
    expect(launch.packagingTasks).toHaveLength(6)
    expect(launch.launchDayTasks).toHaveLength(6)
    expect(launch.priorityBrands).toContain('Nike')
  })

  it('separates active stock from launch-eligible stock', () => {
    const businessSettings = settings()
    businessSettings.launchCommand = updateLaunchTargets(
      businessSettings.launchCommand,
      2,
      2,
    )
    const report = calculateLaunchCommandReport(
      [
        item(),
        item({ sku: 'EXIT-1', grade: 'Exit', brand: 'Wrangler' }),
      ],
      [],
      businessSettings,
      new Date('2026-08-02T12:00:00'),
    )
    expect(report.stock.allActiveItems).toBe(2)
    expect(report.stock.eligibleItems).toBe(1)
    expect(report.stock.exitItems).toBe(1)
    expect(report.stock.gap).toBe(1)
  })

  it('counts launch-ready listings separately from owned stock', () => {
    const businessSettings = settings()
    businessSettings.launchCommand = updateLaunchTargets(
      businessSettings.launchCommand,
      3,
      3,
    )
    const report = calculateLaunchCommandReport(
      [
        item(),
        item({ sku: 'PREP-1', pipelineStage: 'Preparation', status: 'Prep' }),
        item({ sku: 'PHOTO-1', pipelineStage: 'Photography', status: 'Prep' }),
      ],
      [],
      businessSettings,
      new Date('2026-08-02T12:00:00'),
    )
    expect(report.stock.eligibleItems).toBe(3)
    expect(report.listings.readyItems).toBe(1)
    expect(report.listings.gap).toBe(2)
  })

  it('marks overdue marketing tasks from the launch date', () => {
    const businessSettings = settings()
    const report = calculateLaunchCommandReport(
      [],
      [],
      businessSettings,
      new Date('2026-12-20T12:00:00'),
    )
    expect(report.marketing.overdue).toBeGreaterThan(0)
    expect(report.blockers.some(blocker => blocker.id === 'marketing-overdue')).toBe(true)
  })

  it('tracks manual launch task completion', () => {
    let launch = createDefaultLaunchCommandSettings()
    launch = toggleLaunchTask(
      launch,
      'marketing',
      'coming-soon',
      new Date('2026-08-02T12:00:00'),
    )
    expect(launch.marketingTasks.find(task => task.id === 'coming-soon')?.completedAt).toBeTruthy()
    launch = toggleLaunchTask(
      launch,
      'marketing',
      'coming-soon',
      new Date('2026-08-03T12:00:00'),
    )
    expect(launch.marketingTasks.find(task => task.id === 'coming-soon')?.completedAt).toBeUndefined()
  })

  it('uses recorded cash controls when estimating the sourcing gap', () => {
    const businessSettings = settings()
    businessSettings.launchCommand = updateLaunchTargets(
      businessSettings.launchCommand,
      20,
      20,
    )
    const report = calculateLaunchCommandReport(
      [item()],
      [],
      businessSettings,
      new Date('2026-08-02T12:00:00'),
    )
    expect(report.stock.estimatedGapCost).toBe(190)
    expect(report.stock.currentSafeSourcingCash).toBe(100)
    expect(report.stock.affordabilityGap).toBeGreaterThanOrEqual(0)
  })

  it('does not mutate inventory or settings', () => {
    const items = [item()]
    const businessSettings = settings()
    const itemsBefore = JSON.stringify(items)
    const settingsBefore = JSON.stringify(businessSettings)
    calculateLaunchCommandReport(items, [], businessSettings)
    expect(JSON.stringify(items)).toBe(itemsBefore)
    expect(JSON.stringify(businessSettings)).toBe(settingsBefore)
  })
})
