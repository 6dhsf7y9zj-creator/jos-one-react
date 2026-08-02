import { describe, expect, it } from 'vitest'
import type {
  FinanceState,
  InventoryItem,
  JosSettings,
  OrderRecord,
} from '../types/inventory'
import { calculateBusinessForecast } from './businessForecasting'

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
  expectedSalePrice: 40,
  storageLocation: 'A1',
  dateSourced: '2026-07-01',
  dateListed: '2026-07-05',
  ...overrides,
})

const finance = (
  openingCash = 0,
  transactions: FinanceState['transactions'] = [],
  overrides: Partial<FinanceState> = {},
): FinanceState => ({
  openingCash,
  emergencyReserve: 0,
  plannedSourcingBudget: 0,
  taxPlanningRate: 20,
  transactions,
  ...overrides,
})

const settings = (financeState: FinanceState): JosSettings => ({
  minimumProfit: 15,
  targetRoi: 150,
  storageLocations: ['A1'],
  finance: financeState,
})

describe('Business Forecasting Engine', () => {
  it('keeps scenario outcomes ordered', () => {
    const report = calculateBusinessForecast(
      [item()],
      [],
      settings(finance(100)),
      { scenario: 'base', horizonWeeks: 12, monthlyProfitTarget: 5000 },
      new Date('2026-08-02T12:00:00'),
    )
    expect(report.scenarioComparison.conservative.projectedSales)
      .toBeLessThanOrEqual(report.scenarioComparison.base.projectedSales)
    expect(report.scenarioComparison.base.projectedSales)
      .toBeLessThanOrEqual(report.scenarioComparison.optimistic.projectedSales)
  })

  it('does not forecast a sale already recorded in Finance', () => {
    const report = calculateBusinessForecast(
      [item()],
      [],
      settings(finance(100, [{
        id: 'SALE-1',
        date: '2026-08-01',
        type: 'sale',
        category: 'Vinted sale',
        amount: 40,
        description: 'Nike sale',
        sku: 'JAE-001',
      }])),
      { scenario: 'base' },
      new Date('2026-08-02T12:00:00'),
    )
    expect(report.candidates.some(candidate => candidate.sku === 'JAE-001')).toBe(false)
  })

  it('places an unrecorded active order into the first forecast week', () => {
    const orders: OrderRecord[] = [{
      id: 'ORDER-1',
      sku: 'JAE-001',
      item: 'Nike hoodie',
      status: 'Packed',
      deadline: '2026-08-03',
      salePrice: 40,
    }]
    const report = calculateBusinessForecast(
      [item({ status: 'Sold' })],
      orders,
      settings(finance(100)),
      { scenario: 'base' },
      new Date('2026-08-02T12:00:00'),
    )
    expect(report.weeks[0].projectedSales).toBe(40)
    expect(report.candidates.filter(candidate => candidate.sku === 'JAE-001')).toHaveLength(1)
  })

  it('does not subtract cost of goods from future cash a second time', () => {
    const report = calculateBusinessForecast(
      [item({ status: 'Sold', actualSalePrice: 40 })],
      [],
      settings(finance(100)),
      { scenario: 'base' },
      new Date('2026-08-02T12:00:00'),
    )
    expect(report.weeks[0].projectedOperatingProfit).toBe(30)
    expect(report.weeks[0].closingCash).toBe(134)
  })

  it('caps safe sourcing capacity and protects reserves', () => {
    const report = calculateBusinessForecast(
      [],
      [],
      settings(finance(500, [], {
        emergencyReserve: 200,
        plannedSourcingBudget: 150,
      })),
      { scenario: 'base' },
      new Date('2026-08-02T12:00:00'),
    )
    expect(report.summary.safeSourcingCapacity).toBe(150)
  })

  it('shows the monthly target gap without inventing success', () => {
    const report = calculateBusinessForecast(
      [],
      [],
      settings(finance(0)),
      { scenario: 'base', monthlyProfitTarget: 5000 },
      new Date('2026-08-02T12:00:00'),
    )
    expect(report.summary.rolling30DayProfit).toBe(0)
    expect(report.summary.monthlyTargetGap).toBe(5000)
    expect(report.summary.targetProgress).toBe(0)
  })

  it('does not mutate supplied records', () => {
    const items = [item()]
    const businessSettings = settings(finance(100))
    const itemsBefore = JSON.stringify(items)
    const settingsBefore = JSON.stringify(businessSettings)
    calculateBusinessForecast(items, [], businessSettings)
    expect(JSON.stringify(items)).toBe(itemsBefore)
    expect(JSON.stringify(businessSettings)).toBe(settingsBefore)
  })
})
