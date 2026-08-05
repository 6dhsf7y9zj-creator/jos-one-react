import type {
  FinanceState,
  FinanceTransaction,
  InventoryItem,
} from '../types/inventory.ts'

export const defaultFinanceState: FinanceState = {
  openingCash: 0,
  emergencyReserve: 0,
  plannedSourcingBudget: 0,
  taxPlanningRate: 20,
  transactions: [],
}

export type FinanceSummary = {
  salesIncome: number
  businessExpenses: number
  costOfGoodsSold: number
  grossProfit: number
  operatingProfit: number
  capitalAdded: number
  ownerWithdrawals: number
  taxReserved: number
  taxReleased: number
  taxReserveBalance: number
  cashBalance: number
  suggestedTaxReserve: number
  additionalTaxReserveNeeded: number
  safeCashAfterEmergencyReserve: number
  availableSourcingBudget: number
  inventoryCost: number
  expectedInventorySales: number
  expectedInventoryProfit: number
  monthSales: number
  monthExpenses: number
  monthOperatingProfit: number
}

export function normaliseFinanceState(value?: FinanceState): FinanceState {
  if (!value) return defaultFinanceState
  return {
    openingCash: Number.isFinite(value.openingCash) ? value.openingCash : 0,
    emergencyReserve: Number.isFinite(value.emergencyReserve) ? value.emergencyReserve : 0,
    plannedSourcingBudget: Number.isFinite(value.plannedSourcingBudget) ? value.plannedSourcingBudget : 0,
    taxPlanningRate: Number.isFinite(value.taxPlanningRate) ? value.taxPlanningRate : 20,
    transactions: Array.isArray(value.transactions) ? value.transactions : [],
  }
}

function inCurrentMonth(date: string, now: Date): boolean {
  const value = new Date(`${date}T12:00:00`)
  return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth()
}

function linkedCost(transaction: FinanceTransaction, itemsBySku: Map<string, InventoryItem>): number {
  if (transaction.type !== 'sale' || !transaction.sku) return 0
  return itemsBySku.get(transaction.sku)?.purchasePrice ?? 0
}

export function calculateFinanceSummary(
  stateInput: FinanceState | undefined,
  items: InventoryItem[],
  now = new Date(),
): FinanceSummary {
  const state = normaliseFinanceState(stateInput)
  const itemsBySku = new Map(items.map(item => [item.sku, item]))

  let salesIncome = 0
  let businessExpenses = 0
  let costOfGoodsSold = 0
  let capitalAdded = 0
  let ownerWithdrawals = 0
  let taxReserved = 0
  let taxReleased = 0
  let monthSales = 0
  let monthExpenses = 0
  let monthCostOfGoods = 0

  for (const transaction of state.transactions) {
    const amount = Math.max(0, transaction.amount)
    const currentMonth = inCurrentMonth(transaction.date, now)

    switch (transaction.type) {
      case 'sale': {
        salesIncome += amount
        const cost = linkedCost(transaction, itemsBySku)
        costOfGoodsSold += cost
        if (currentMonth) {
          monthSales += amount
          monthCostOfGoods += cost
        }
        break
      }
      case 'expense':
        businessExpenses += amount
        if (currentMonth) monthExpenses += amount
        break
      case 'owner-funding':
        capitalAdded += amount
        break
      case 'owner-withdrawal':
        ownerWithdrawals += amount
        break
      case 'tax-reserve-in':
        taxReserved += amount
        break
      case 'tax-reserve-out':
        taxReleased += amount
        break
    }
  }

  const grossProfit = salesIncome - costOfGoodsSold
  const operatingProfit = grossProfit - businessExpenses
  const taxReserveBalance = taxReserved - taxReleased

  const cashBalance =
    state.openingCash +
    salesIncome +
    capitalAdded +
    taxReleased -
    businessExpenses -
    ownerWithdrawals -
    taxReserved

  const suggestedTaxReserve =
    Math.max(0, operatingProfit) * (Math.max(0, state.taxPlanningRate) / 100)
  const additionalTaxReserveNeeded = Math.max(0, suggestedTaxReserve - taxReserveBalance)
  const safeCashAfterEmergencyReserve = Math.max(0, cashBalance - Math.max(0, state.emergencyReserve))
  const availableSourcingBudget = state.plannedSourcingBudget > 0
    ? Math.max(0, Math.min(safeCashAfterEmergencyReserve, state.plannedSourcingBudget))
    : safeCashAfterEmergencyReserve

  const activeItems = items.filter(item => !['Dispatched', 'Archived'].includes(item.status))
  const inventoryCost = activeItems.reduce((sum, item) => sum + item.purchasePrice, 0)
  const expectedInventorySales = activeItems.reduce((sum, item) => sum + item.expectedSalePrice, 0)
  const expectedInventoryProfit = expectedInventorySales - inventoryCost

  return {
    salesIncome,
    businessExpenses,
    costOfGoodsSold,
    grossProfit,
    operatingProfit,
    capitalAdded,
    ownerWithdrawals,
    taxReserved,
    taxReleased,
    taxReserveBalance,
    cashBalance,
    suggestedTaxReserve,
    additionalTaxReserveNeeded,
    safeCashAfterEmergencyReserve,
    availableSourcingBudget,
    inventoryCost,
    expectedInventorySales,
    expectedInventoryProfit,
    monthSales,
    monthExpenses,
    monthOperatingProfit: monthSales - monthCostOfGoods - monthExpenses,
  }
}

export function createFinanceTransactionId(): string {
  return `FIN-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

export function formatFinanceMoney(value: number): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}£${Math.abs(value).toFixed(2)}`
}

export function financeTransactionEffect(transaction: FinanceTransaction): number {
  switch (transaction.type) {
    case 'sale':
    case 'owner-funding':
    case 'tax-reserve-out':
      return transaction.amount
    case 'expense':
    case 'owner-withdrawal':
    case 'tax-reserve-in':
      return -transaction.amount
  }
}
