export type StockStatus = 'Prep' | 'Photographed' | 'Live' | 'Sold' | 'Dispatched' | 'Archived';

export type ListingPipelineStage =
  | 'Preparation'
  | 'Photography'
  | 'Photo Review'
  | 'Listing Copy'
  | 'Ready to Upload'
  | 'Live';

export interface PhotoChecklist {
  front: boolean;
  back: boolean;
  brandLabel: boolean;
  sizeLabel: boolean;
  careLabel: boolean;
  measurements: boolean;
  defects: boolean;
}

export interface ListingChecklist {
  title: boolean;
  description: boolean;
  measurements: boolean;
  condition: boolean;
  price: boolean;
  platform: boolean;
}

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
  pipelineStage?: ListingPipelineStage;
  photoChecklist?: PhotoChecklist;
  listingChecklist?: ListingChecklist;
  photographyStartedAt?: string;
  photographyCompletedAt?: string;
  listingReadyAt?: string;
}

export type OrderStatus =
  | 'Paid'
  | 'Ready to pack'
  | 'Packed'
  | 'Dispatched'
  | 'Delivered'
  | 'Return requested'
  | 'Returned'
  | 'Refunded'
  | 'Cancelled';

export interface OrderRecord {
  id: string;
  sku: string;
  item: string;
  status: string;
  deadline: string;
  buyerName?: string;
  buyerUsername?: string;
  platform?: string;
  salePrice?: number;
  postageIncome?: number;
  trackingNumber?: string;
  carrier?: string;
  placedAt?: string;
  packedAt?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  returnReason?: string;
  refundAmount?: number;
  notes?: string;
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


export type AutomationRuleId =
  | 'daily-ceo-review'
  | 'weekly-backup-check'
  | 'weekly-ageing-review'
  | 'weekly-finance-check'
  | 'weekly-launch-review';

export interface AutomationRuleState {
  id: AutomationRuleId;
  enabled: boolean;
  lastCompletedAt?: string;
  snoozedUntil?: string;
}

export interface AutomationHistoryEntry {
  id: string;
  ruleId: AutomationRuleId;
  completedAt: string;
}

export interface LaunchChecklistState {
  id: string;
  completedAt?: string;
}

export interface AutomationSettings {
  rules: AutomationRuleState[];
  launchDate: string;
  launchChecklist: LaunchChecklistState[];
  history: AutomationHistoryEntry[];
}

export interface JosSettings {
  minimumProfit: number;
  targetRoi: number;
  storageLocations: string[];
  monthlyProfitTarget?: number;
  automation?: AutomationSettings;
  finance?: FinanceState;
}
