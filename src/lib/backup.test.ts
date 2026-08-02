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

  it('rejects duplicate SKUs', () => {
    expect(() => migrateBackup({ items: [
      { sku: 'JAE-1', brand: 'Nike' },
      { sku: 'JAE-1', brand: 'Adidas' },
    ] })).toThrow(/Duplicate SKU/)
  })
})
