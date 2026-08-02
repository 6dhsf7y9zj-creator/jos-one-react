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
  colour?: string;
  notes?: string;
  actualSalePrice?: number;
  dateSourced?: string;
  dateListed?: string;
  dateSold?: string;
}

export interface OrderRecord {
  id: string;
  sku: string;
  item: string;
  status: string;
  deadline: string;
}

export type FinanceTransactionType =
  | 'sale'
  | 'expense'
  | 'owner-funding'
  | 'owner-withdrawal'
  | 'tax-reserve-in'
  | 'tax-reserve-out';

export interface FinanceTransaction {
  id: string;
  date: string;
  type: FinanceTransactionType;
  category: string;
  amount: number;
  description: string;
  sku?: string;
  notes?: string;
}

export interface FinanceState {
  openingCash: number;
  emergencyReserve: number;
  plannedSourcingBudget: number;
  taxPlanningRate: number;
  transactions: FinanceTransaction[];
}

export interface JosSettings {
  minimumProfit: number;
  targetRoi: number;
  storageLocations: string[];
  finance?: FinanceState;
}
