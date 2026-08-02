import { describe, expect, it } from 'vitest'
import { migrateBackup } from './backup'

describe('backup migration', () => {
  it('maps legacy 1.1 fields into the React inventory model', () => {
    const result = migrateBackup({
      version: '1.1.0',
      items: [{
        sku: 'JAE-PRE-001', brand: 'Nike', category: 'Hoodie', description: 'White Hoodie', size: 'M',
        condition: 'Good', status: 'Photographed', grade: 'C', storage: 'TBC', purchasePrice: 6.4,
        landedCost: 9.97, expectedSale: 21.93,
      }],
      orders: [],
      settings: { minimumProfit: 15, targetRoi: 150, storageLocations: ['Box A1'] },
    })

    expect(result.items[0].purchasePrice).toBe(9.97)
    expect(result.items[0].originalPurchasePrice).toBe(6.4)
    expect(result.items[0].expectedSalePrice).toBe(21.93)
    expect(result.items[0].storageLocation).toBe('TBC')
  })

  it('preserves forecasting and automation settings', () => {
    const result = migrateBackup({
      version: '3.3.0',
      items: [],
      orders: [],
      settings: {
        minimumProfit: 15,
        targetRoi: 150,
        monthlyProfitTarget: 5000,
        storageLocations: ['A1'],
        automation: {
          launchDate: '2027-01-15',
          rules: [{
            id: 'daily-ceo-review',
            enabled: true,
            lastCompletedAt: '2026-08-02T12:00:00.000Z',
          }],
          launchChecklist: [{
            id: 'launch-target',
            completedAt: '2026-08-01T12:00:00.000Z',
          }],
          history: [],
        },
        launchCommand: {
          openingStockTarget: 40,
          readyListingTarget: 35,
          priorityBrands: ['Nike', 'Carhartt'],
          marketingTasks: [{
            id: 'coming-soon',
            completedAt: '2026-08-01T12:00:00.000Z',
          }],
          packagingTasks: [],
          launchDayTasks: [],
        },
      },
    })

    expect(result.settings.monthlyProfitTarget).toBe(5000)
    expect(result.settings.automation?.launchDate).toBe('2027-01-15')
    expect(result.settings.automation?.rules).toHaveLength(5)
    expect(result.settings.automation?.launchChecklist[0].completedAt).toBeTruthy()
    expect(result.settings.launchCommand?.openingStockTarget).toBe(40)
    expect(result.settings.launchCommand?.readyListingTarget).toBe(35)
    expect(result.settings.launchCommand?.marketingTasks).toHaveLength(10)
    expect(result.settings.launchCommand?.marketingTasks[0].completedAt).toBeTruthy()
  })

  it('rejects duplicate SKUs', () => {
    expect(() => migrateBackup({ items: [
      { sku: 'JAE-1', brand: 'Nike' },
      { sku: 'JAE-1', brand: 'Adidas' },
    ] })).toThrow(/Duplicate SKU/)
  })
})
