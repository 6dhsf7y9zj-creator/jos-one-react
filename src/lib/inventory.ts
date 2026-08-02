import type { InventoryItem, StockStatus } from '../types/inventory';

export const lifecycle: StockStatus[] = ['Prep', 'Photographed', 'Live', 'Sold', 'Dispatched', 'Archived'];

export function expectedProfit(item: InventoryItem): number {
  return Number((item.expectedSalePrice - item.purchasePrice).toFixed(2));
}

export function nextStatus(status: StockStatus): StockStatus {
  const index = lifecycle.indexOf(status);
  return lifecycle[Math.min(index + 1, lifecycle.length - 1)];
}

export function generateSku(existing: InventoryItem[]): string {
  const highest = existing.reduce((max, item) => {
    const match = item.sku.match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `JAE-${String(highest + 1).padStart(4, '0')}`;
}

export const createSku = generateSku;
