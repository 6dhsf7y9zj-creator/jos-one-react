import { describe, expect, it } from 'vitest'
import type { FinanceState, InventoryItem } from '../types/inventory.ts'
import { calculateInventoryIntelligence } from './inventoryIntelligence.ts'

const item = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  sku: 'JAE-001',
  brand: 'Nike',
  category: 'Hoodie',
  description: 'Nike hoodie',
  size: 'M',
  condition: 'Very Good',
  status: 'Live',
  grade: 'B',
  purchasePrice: 5,
  expectedSalePrice: 25,
  storageLocation: 'A1',
  dateListed: '2026-07-20',
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

describe('Inventory Intelligence Engine', () => {
  it('calculates a recommendation without overwriting the saved grade', () => {
    const stock = item({ grade: 'C' })
    const report = calculateInventoryIntelligence(
      [stock],
      undefined,
      new Date('2026-08-02T12:00:00'),
    )
    expect(report.items[0].recommendedGrade).toBe('A')
    expect(report.items[0].item.grade).toBe('C')
    expect(report.items[0].gradeChanged).toBe(true)
  })

  it('marks old low-return stock for exit review', () => {
    const report = calculateInventoryIntelligence(
      [item({
        purchasePrice: 20,
        expectedSalePrice: 25,
        dateListed: '2026-03-01',
      })],
      undefined,
      new Date('2026-08-02T12:00:00'),
    )
    expect(report.items[0].recommendedGrade).toBe('Exit')
    expect(report.items[0].healthBand).toBe('exit')
  })

  it('uses linked sale evidence for realised brand performance', () => {
    const finance: FinanceState = {
      openingCash: 0,
      emergencyReserve: 0,
      plannedSourcingBudget: 0,
      taxPlanningRate: 20,
      transactions: [{
        id: 'SALE-1',
        date: '2026-08-01',
        type: 'sale',
        category: 'Vinted sale',
        amount: 25,
        description: 'Nike hoodie sale',
        sku: 'JAE-001',
      }],
    }
    const report = calculateInventoryIntelligence([item()], finance)
    expect(report.brands[0].realisedSales).toBe(1)
    expect(report.brands[0].realisedProfit).toBe(20)
    expect(report.brands[0].evidence).toBe('limited')
  })

  it('warns about very similar records without declaring them duplicates', () => {
    const report = calculateInventoryIntelligence([
      item(),
      item({
        sku: 'JAE-002',
        description: 'Nike pullover hoodie',
        colour: 'Black',
      }),
      item({
        sku: 'JAE-003',
        description: 'Nike hoodie',
        colour: 'Black',
      }),
    ])
    expect(report.duplicateCandidates.length).toBeGreaterThan(0)
    expect(['possible', 'strong']).toContain(report.duplicateCandidates[0].confidence)
  })
})
