import { describe, expect, it } from 'vitest';
import { createSku, expectedProfit, nextStatus } from './inventory';
import type { InventoryItem } from '../types/inventory';

const item: InventoryItem = {
  sku: 'JAE-0001', brand: 'Nike', category: 'Hoodie', description: 'Black hoodie', size: 'M',
  condition: 'Very good', status: 'Prep', grade: 'A', purchasePrice: 6, expectedSalePrice: 28,
  storageLocation: 'Box A1'
};

describe('inventory helpers', () => {
  it('calculates expected profit', () => expect(expectedProfit(item)).toBe(22));
  it('moves to the next lifecycle stage', () => expect(nextStatus('Prep')).toBe('Photographed'));
  it('creates the next SKU', () => expect(createSku([item])).toBe('JAE-0002'));
});
