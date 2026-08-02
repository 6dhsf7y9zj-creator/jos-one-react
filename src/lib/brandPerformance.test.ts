import { describe, expect, it } from 'vitest'
import type { FinanceState, InventoryItem } from '../types/inventory'
import { calculateBrandPerformance } from './brandPerformance'

const item = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  sku: 'JAE-001',
  brand: 'Carhartt',
  category: 'Jacket',
  description: 'Carhartt work jacket',
  size: 'M',
  condition: 'Very Good',
  status: 'Live',
  grade: 'A',
  purchasePrice: 10,
  expectedSalePrice: 40,
  storageLocation: 'A1',
  dateSourced: '2026-07-01',
  dateListed: '2026-07-05',
  ...overrides,
})

const finance = (transactions: FinanceState['transactions']): FinanceState => ({
  openingCash: 0,
  emergencyReserve: 0,
  plannedSourcingBudget: 0,
  taxPlanningRate: 20,
  transactions,
})

const sale = (id: string, sku: string, amount: number, date: string) => ({
  id,
  date,
  type: 'sale' as const,
  category: 'Vinted sale',
  amount,
  description: `Sale ${sku}`,
  sku,
})

const targets = { targetRoi: 150, minimumProfit: 15 }

describe('Brand Performance Engine', () => {
  it('keeps forecast-only brands on Hold', () => {
    const report = calculateBrandPerformance([item()], finance([]), targets)
    expect(report.brands[0].evidence).toBe('forecast-only')
    expect(report.brands[0].recommendation).toBe('Hold')
  })

  it('calculates realised ROI and average days from linked sales', () => {
    const records = [
      item({ sku: 'S1', status: 'Dispatched', dateListed: '2026-07-01' }),
      item({ sku: 'S2', status: 'Dispatched', dateListed: '2026-07-05' }),
    ]
    const report = calculateBrandPerformance(
      records,
      finance([
        sale('1', 'S1', 40, '2026-07-11'),
        sale('2', 'S2', 40, '2026-07-20'),
      ]),
      targets,
    )
    expect(report.brands[0].realisedProfit).toBe(60)
    expect(report.brands[0].realisedRoi).toBe(300)
    expect(report.brands[0].averageDaysToSell).toBe(12.5)
  })

  it('recommends Buy More only after sufficient strong evidence', () => {
    const records = [
      item({ sku: 'S1', status: 'Dispatched', dateListed: '2026-07-01' }),
      item({ sku: 'S2', status: 'Dispatched', dateListed: '2026-07-02' }),
      item({ sku: 'S3', status: 'Dispatched', dateListed: '2026-07-03' }),
      item({ sku: 'A1', status: 'Live', dateListed: '2026-07-25' }),
    ]
    const report = calculateBrandPerformance(
      records,
      finance([
        sale('1', 'S1', 40, '2026-07-12'),
        sale('2', 'S2', 42, '2026-07-14'),
        sale('3', 'S3', 41, '2026-07-15'),
      ]),
      targets,
    )
    expect(report.brands[0].recommendation).toBe('Buy More')
  })

  it('reduces buying when realised returns miss the target', () => {
    const records = [
      item({ sku: 'S1', status: 'Dispatched', purchasePrice: 20 }),
      item({ sku: 'S2', status: 'Dispatched', purchasePrice: 20 }),
      item({ sku: 'A1', purchasePrice: 20, dateListed: '2026-04-01' }),
    ]
    const report = calculateBrandPerformance(
      records,
      finance([
        sale('1', 'S1', 25, '2026-07-20'),
        sale('2', 'S2', 25, '2026-07-21'),
      ]),
      targets,
      new Date('2026-08-02T12:00:00'),
    )
    expect(['Reduce Buying', 'Exit Brand']).toContain(report.brands[0].recommendation)
  })

  it('deduplicates repeated sale links for one SKU', () => {
    const records = [item({ sku: 'S1', status: 'Dispatched' })]
    const report = calculateBrandPerformance(
      records,
      finance([
        sale('1', 'S1', 40, '2026-07-12'),
        sale('2', 'S1', 42, '2026-07-13'),
      ]),
      targets,
    )
    expect(report.dataQuality.duplicateSaleLinks).toBe(1)
    expect(report.dataQuality.linkedSales).toBe(1)
    expect(report.brands[0].completedSales).toBe(1)
  })
})
