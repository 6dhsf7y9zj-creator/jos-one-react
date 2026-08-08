import type { InventoryItem, StockStatus } from '../types/inventory.ts';

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


export function itemRoi(item: InventoryItem): number {
  if (item.purchasePrice <= 0) return 0;
  return Number(((expectedProfit(item) / item.purchasePrice) * 100).toFixed(1));
}

export function duplicateSkus(items: InventoryItem[]): string[] {
  const counts = new Map<string, number>();
  items.forEach(item => counts.set(item.sku, (counts.get(item.sku) ?? 0) + 1));
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([sku]) => sku);
}

export function normaliseInventoryText(item: InventoryItem): string {
  return [
    item.sku,
    item.brand,
    item.category,
    item.description,
    item.department,
    item.size,
    item.condition,
    item.status,
    item.grade,
    item.storageLocation,
    item.colour,
    item.notes,
    item.platform,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
