import { describe, expect, it } from 'vitest'
import type {
  FinanceState,
  InventoryItem,
  JosSettings,
  OrderRecord,
} from '../types/inventory'
import { calculateCeoRecommendations } from './ceoRecommendations'

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
  dateSourced: '2026-07-01',
  dateListed: '2026-07-05',
  photoChecklist: {
    front: true,
    back: true,
    brandLabel: true,
    sizeLabel: true,
    careLabel: true,
    measurements: true,
    defects: true,
  },
  listingChecklist: {
    title: true,
    description: true,
    measurements: true,
    condition: true,
    price: true,
    platform: true,
  },
  ...overrides,
})

const finance = (
  openingCash = 0,
  transactions: FinanceState['transactions'] = [],
): FinanceState => ({
  openingCash,
  emergencyReserve: 0,
  plannedSourcingBudget: openingCash,
  taxPlanningRate: 20,
  transactions,
})

const settings = (
  financeState: FinanceState = finance(),
): JosSettings => ({
  minimumProfit: 15,
  targetRoi: 150,
  storageLocations: ['A1'],
  finance: financeState,
})

describe('CEO Recommendation Engine', () => {
  it('ranks customer commitments before growth or sourcing work', () => {
    const orders: OrderRecord[] = [{
      id: 'ORDER-1',
      sku: 'JAE-001',
      item: 'Nike hoodie',
      status: 'Packed',
      deadline: '2026-08-03',
      salePrice: 35,
    }]
    const report = calculateCeoRecommendations(
      [item()],
      orders,
      settings(finance(200)),
      new Date('2026-08-02T12:00:00'),
    )
    expect(report.todayPlan[0].id).toBe('dispatch-customer-commitments')
    expect(report.todayPlan[0].impact.protectedRevenue).toBe(35)
    expect(report.sourcingDecision).toBe('blocked')
  })

  it('blocks sourcing while pipeline work is waiting even when cash exists', () => {
    const stock = item({
      status: 'Prep',
      photoChecklist: undefined,
      listingChecklist: undefined,
    })
    const report = calculateCeoRecommendations(
      [stock],
      [],
      settings(finance(250)),
      new Date('2026-08-02T12:00:00'),
    )
    expect(report.sourcingDecision).toBe('blocked')
    expect(report.allRecommendations.some(
      recommendation => recommendation.id === 'hold-sourcing-for-backlog',
    )).toBe(true)
  })

  it('does not create a Buy More recommendation from forecast-only brands', () => {
    const report = calculateCeoRecommendations(
      [item()],
      [],
      settings(finance(200)),
      new Date('2026-08-02T12:00:00'),
    )
    expect(report.sourcingDecision).toBe('hold')
    expect(report.allRecommendations.some(
      recommendation => recommendation.title.startsWith('Source Nike selectively'),
    )).toBe(false)
  })

  it('labels ageing purchase cost as cash under review rather than guaranteed release', () => {
    const report = calculateCeoRecommendations(
      [item({
        dateListed: '2026-03-01',
        daysInStock: 154,
      })],
      [],
      settings(finance()),
      new Date('2026-08-02T12:00:00'),
    )
    const ageing = report.allRecommendations.find(
      recommendation => recommendation.id === 'review-ageing-stock',
    )
    expect(ageing?.impact.cashUnderReview).toBe(10)
    expect(ageing?.detail).toContain('should be reviewed for release—not assumed recovered')
  })

  it('does not mutate the supplied business records', () => {
    const stock = [item()]
    const businessSettings = settings(finance(100))
    const stockBefore = JSON.stringify(stock)
    const settingsBefore = JSON.stringify(businessSettings)
    calculateCeoRecommendations(stock, [], businessSettings)
    expect(JSON.stringify(stock)).toBe(stockBefore)
    expect(JSON.stringify(businessSettings)).toBe(settingsBefore)
  })

  it('keeps the ordinary plan within the configured time capacity', () => {
    const report = calculateCeoRecommendations(
      [
        item({ sku: 'A', status: 'Prep', photoChecklist: undefined, listingChecklist: undefined }),
        item({ sku: 'B', status: 'Prep', photoChecklist: undefined, listingChecklist: undefined }),
        item({ sku: 'C', status: 'Photographed', listingChecklist: undefined }),
      ],
      [],
      settings(finance(100)),
      new Date('2026-08-02T12:00:00'),
      60,
    )
    expect(report.planMinutes).toBeLessThanOrEqual(60)
  })
})
