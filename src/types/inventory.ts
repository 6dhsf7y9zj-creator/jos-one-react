export type StockStatus = 'Prep' | 'Photographed' | 'Live' | 'Sold' | 'Dispatched' | 'Archived';

export interface InventoryItem {
  sku: string;
  brand: string;
  category: string;
  description: string;
  size: string;
  condition: string;
  status: StockStatus;
  grade: 'A' | 'B' | 'C' | 'Exit';
  purchasePrice: number;
  expectedSalePrice: number;
  storageLocation: string;
}
