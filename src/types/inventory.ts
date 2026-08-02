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
  department?: string;
  originalPurchasePrice?: number;
  landedCost?: number;
  listPrice?: number;
  expectedProfit?: number;
  roi?: number;
  daysInStock?: number;
  action?: string;
  listingStage?: string;
  platform?: string;
}

export interface OrderRecord {
  id: string;
  sku: string;
  item: string;
  status: string;
  deadline: string;
}

export interface JosSettings {
  minimumProfit: number;
  targetRoi: number;
  storageLocations: string[];
}
