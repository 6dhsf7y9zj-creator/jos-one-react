import { useMemo, useState } from 'react'
import type {
  FinanceState,
  FinanceTransaction,
  FinanceTransactionType,
  InventoryItem,
} from '../types/inventory.ts'
import {
  calculateFinanceSummary,
  createFinanceTransactionId,
  defaultFinanceState,
  financeTransactionEffect,
  formatFinanceMoney,
  normaliseFinanceState,
} from '../lib/finance.ts'
import { JosButton, KpiCard, NoticeCard, SectionHeader } from '../ui/index.ts'

type FinanceProps = {
  items: InventoryItem[]
  finance?: FinanceState
  onChange: (finance: FinanceState) => void
  onOpenForecasting: () => void
}

type LedgerFilter = 'all' | FinanceTransactionType

const categories: Record<FinanceTransactionType, string[]> = {
  sale: ['Vinted sale', 'eBay sale', 'Shopify sale', 'Other sale'],
  expense: ['Packaging', 'Postage', 'Marketplace fees', 'Mileage', 'Equipment', 'Software', 'Storage', 'Cleaning', 'Other expense'],
  'owner-funding': ['Owner funding'],
  'owner-withdrawal': ['Owner withdrawal'],
  'tax-reserve-in': ['Tax reserve transfer'],
  'tax-reserve-out': ['Tax payment / reserve release'],
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function transactionLabel(type: FinanceTransactionType): string {
  return {
    sale: 'Sale income',
    expense: 'Business expense',
    'owner-funding': 'Owner funding',
    'owner-withdrawal': 'Owner withdrawal',
    'tax-reserve-in': 'Move to tax reserve',
    'tax-reserve-out': 'Release tax reserve',
  }[type]
}

function downloadLedger(transactions: FinanceTransaction[]): void {
  const header = ['Date', 'Type', 'Category', 'Description', 'SKU', 'Amount', 'Notes']
  const rows = transactions.map(transaction => [
    transaction.date,
    transaction.type,
    transaction.category,
    transaction.description,
    transaction.sku ?? '',
    transaction.amount.toFixed(2),
    transaction.notes ?? '',
  ])
  const csv = [header, ...rows]
    .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `JOS-finance-ledger-${today()}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function FinanceCommandCentre({ items, finance, onChange, onOpenForecasting }: FinanceProps) {
  const state = normaliseFinanceState(finance)
  const summary = useMemo(() => calculateFinanceSummary(state, items), [state, items])
  const [formOpen, setFormOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [filter, setFilter] = useState<LedgerFilter>('all')
  const [message, setMessage] = useState('')
  const [type, setType] = useState<FinanceTransactionType>('sale')
  const [date, setDate] = useState(today())
  const [category, setCategory] = useState(categories.sale[0])
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [sku, setSku] = useState('')
  const [notes, setNotes] = useState('')

  const sortedTransactions = [...state.transactions]
    .filter(transaction => filter === 'all' || transaction.type === filter)
    .sort((a, b) => `${b.date}-${b.id}`.localeCompare(`${a.date}-${a.id}`))

  const updateFinance = (patch: Partial<FinanceState>) => {
    onChange({ ...state, ...patch })
  }

  const resetForm = () => {
    setType('sale')
    setDate(today())
    setCategory(categories.sale[0])
    setAmount('')
    setDescription('')
    setSku('')
    setNotes('')
  }

  const changeType = (nextType: FinanceTransactionType) => {
    setType(nextType)
    setCategory(categories[nextType][0])
    if (nextType !== 'sale') setSku('')
  }

  const addTransaction = (event: React.FormEvent) => {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (!date || !description.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setMessage('Date, description and a positive amount are required.')
      return
    }

    const transaction: FinanceTransaction = {
      id: createFinanceTransactionId(),
      date,
      type,
      category,
      amount: numericAmount,
      description: description.trim(),
      sku: type === 'sale' && sku ? sku : undefined,
      notes: notes.trim() || undefined,
    }

    updateFinance({ transactions: [...state.transactions, transaction] })
    setMessage(`${transactionLabel(type)} recorded.`)
    resetForm()
    setFormOpen(false)
  }

  const deleteTransaction = (transaction: FinanceTransaction) => {
    if (!window.confirm(`Delete "${transaction.description}" for ${formatFinanceMoney(transaction.amount)}?`)) return
    updateFinance({
      transactions: state.transactions.filter(entry => entry.id !== transaction.id),
    })
    setMessage('Ledger entry deleted. Backup Centre can recover earlier data.')
  }

  const reserveShortfall = () => {
    if (summary.additionalTaxReserveNeeded <= 0) return
    const transaction: FinanceTransaction = {
      id: createFinanceTransactionId(),
      date: today(),
      type: 'tax-reserve-in',
      category: categories['tax-reserve-in'][0],
      amount: Number(summary.additionalTaxReserveNeeded.toFixed(2)),
      description: 'Top up planning tax reserve',
    }
    updateFinance({ transactions: [...state.transactions, transaction] })
    setMessage(`${formatFinanceMoney(transaction.amount)} moved to the planning tax reserve.`)
  }

  return (
    <main className="screen finance-command-centre">
      <section className="finance-hero">
        <div>
          <p className="eyebrow">FINANCE COMMAND CENTRE</p>
          <h2>Know where the money is</h2>
          <p>Cash, realised trading results, stock exposure and reserves from records entered into JOS.</p>
        </div>
        <div className={summary.cashBalance >= 0 ? 'cash-position positive' : 'cash-position negative'}>
          <span>Business cash</span>
          <strong>{formatFinanceMoney(summary.cashBalance)}</strong>
          <small>After recorded cash movements</small>
        </div>
      </section>

      {message && (
        <NoticeCard title={message} tone="positive" onDismiss={() => setMessage('')} />
      )}

      <section className="jos-kpi-grid" aria-label="Finance summary">
        <KpiCard
          label="Safe cash after emergency reserve"
          value={formatFinanceMoney(summary.safeCashAfterEmergencyReserve)}
          detail={`Emergency reserve: ${formatFinanceMoney(state.emergencyReserve)}`}
          tone={summary.safeCashAfterEmergencyReserve >= 0 ? 'positive' : 'urgent'}
        />
        <KpiCard
          label="Available sourcing budget"
          value={formatFinanceMoney(summary.availableSourcingBudget)}
          detail="Limited by your planned budget"
          tone={summary.availableSourcingBudget > 0 ? 'positive' : 'warning'}
        />
        <KpiCard
          label="Cash tied in active stock"
          value={formatFinanceMoney(summary.inventoryCost)}
          detail={`${items.filter(item => !['Dispatched', 'Archived'].includes(item.status)).length} active items`}
          tone="information"
        />
        <KpiCard
          label="Tax reserve balance"
          value={formatFinanceMoney(summary.taxReserveBalance)}
          detail="Planning reserve—not an HMRC calculation"
          tone={summary.additionalTaxReserveNeeded > 0 ? 'warning' : 'positive'}
        />
      </section>

      <section className="finance-actions">
        <JosButton variant="primary" onClick={() => setFormOpen(true)}>Add transaction</JosButton>
        <JosButton variant="secondary" onClick={() => setSettingsOpen(value => !value)}>Finance settings</JosButton>
        <JosButton variant="secondary" onClick={() => downloadLedger(state.transactions)}>Export ledger CSV</JosButton>
        <JosButton variant="secondary" onClick={onOpenForecasting}>Open forecast</JosButton>
      </section>

      {settingsOpen && (
        <section className="panel finance-settings">
          <SectionHeader eyebrow="PLANNING SETTINGS" title="Cash and reserve rules" compact />
          <div className="finance-settings-grid">
            <label>Opening business cash (£)
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={state.openingCash}
                onChange={event => updateFinance({ openingCash: Number(event.target.value) || 0 })}
              />
            </label>
            <label>Emergency reserve (£)
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={state.emergencyReserve}
                onChange={event => updateFinance({ emergencyReserve: Number(event.target.value) || 0 })}
              />
            </label>
            <label>Maximum sourcing budget (£)
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={state.plannedSourcingBudget}
                onChange={event => updateFinance({ plannedSourcingBudget: Number(event.target.value) || 0 })}
              />
            </label>
            <label>Tax planning percentage (%)
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                inputMode="decimal"
                value={state.taxPlanningRate}
                onChange={event => updateFinance({ taxPlanningRate: Number(event.target.value) || 0 })}
              />
            </label>
          </div>
          <p className="finance-caution">
            The tax percentage is only a cash-planning reserve. It does not calculate your UK tax liability,
            employment interaction, allowances or National Insurance.
          </p>
        </section>
      )}

      <section className="panel finance-profit-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">REALISED PERFORMANCE</p>
            <h2>Recorded trading result</h2>
          </div>
        </div>
        <div className="profit-waterfall">
          <div><span>Sales income</span><strong>{formatFinanceMoney(summary.salesIncome)}</strong></div>
          <div><span>Linked stock cost</span><strong>-{formatFinanceMoney(summary.costOfGoodsSold)}</strong></div>
          <div><span>Gross profit</span><strong>{formatFinanceMoney(summary.grossProfit)}</strong></div>
          <div><span>Business expenses</span><strong>-{formatFinanceMoney(summary.businessExpenses)}</strong></div>
          <div className="profit-total"><span>Operating profit</span><strong>{formatFinanceMoney(summary.operatingProfit)}</strong></div>
        </div>
        <div className="monthly-finance">
          <div><span>This month sales</span><strong>{formatFinanceMoney(summary.monthSales)}</strong></div>
          <div><span>This month expenses</span><strong>{formatFinanceMoney(summary.monthExpenses)}</strong></div>
          <div><span>This month profit</span><strong>{formatFinanceMoney(summary.monthOperatingProfit)}</strong></div>
        </div>
        <p className="finance-caution">
          Stock cost is deducted only when a sale entry is linked to an SKU. Unlinked sales may overstate profit.
        </p>
      </section>

      <section className="panel finance-tax-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">TAX PLANNING RESERVE</p>
            <h2>Keep cash aside deliberately</h2>
          </div>
        </div>
        <div className="tax-reserve-meter">
          <div>
            <span>Suggested planning reserve</span>
            <strong>{formatFinanceMoney(summary.suggestedTaxReserve)}</strong>
          </div>
          <div>
            <span>Already reserved</span>
            <strong>{formatFinanceMoney(summary.taxReserveBalance)}</strong>
          </div>
          <div>
            <span>Additional amount suggested</span>
            <strong>{formatFinanceMoney(summary.additionalTaxReserveNeeded)}</strong>
          </div>
        </div>
        {summary.additionalTaxReserveNeeded > 0 && summary.cashBalance > 0 && (
          <button type="button" className="tax-reserve-action" onClick={reserveShortfall}>
            Record reserve top-up
          </button>
        )}
      </section>

      <section className="panel finance-stock-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">STOCK EXPOSURE</p>
            <h2>Money waiting in inventory</h2>
          </div>
        </div>
        <div className="stock-exposure-grid">
          <div><span>Active stock cost</span><strong>{formatFinanceMoney(summary.inventoryCost)}</strong></div>
          <div><span>Expected sales value</span><strong>{formatFinanceMoney(summary.expectedInventorySales)}</strong></div>
          <div><span>Expected stock profit</span><strong>{formatFinanceMoney(summary.expectedInventoryProfit)}</strong></div>
        </div>
        <p className="finance-caution">Expected values are forecasts and are not cash until items sell and payment is received.</p>
      </section>

      <section className="panel finance-ledger-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">FINANCE LEDGER</p>
            <h2>Auditable cash history</h2>
          </div>
        </div>

        <div className="ledger-filters">
          {(['all', 'sale', 'expense', 'owner-funding', 'owner-withdrawal', 'tax-reserve-in', 'tax-reserve-out'] as LedgerFilter[]).map(value => (
            <button
              type="button"
              className={filter === value ? 'active' : ''}
              key={value}
              onClick={() => setFilter(value)}
            >
              {value === 'all' ? 'All' : transactionLabel(value)}
            </button>
          ))}
        </div>

        {sortedTransactions.length === 0 ? (
          <div className="empty-ledger">
            <h3>No finance entries yet</h3>
            <p>Add opening cash in settings, then record each sale, expense or owner movement.</p>
          </div>
        ) : (
          <div className="ledger-list">
            {sortedTransactions.map(transaction => {
              const effect = financeTransactionEffect(transaction)
              return (
                <article className="ledger-row" key={transaction.id}>
                  <div className={`ledger-type type-${transaction.type}`}>
                    {transaction.type === 'sale' || transaction.type === 'owner-funding' || transaction.type === 'tax-reserve-out' ? '+' : '−'}
                  </div>
                  <div className="ledger-copy">
                    <strong>{transaction.description}</strong>
                    <small>
                      {new Date(`${transaction.date}T12:00:00`).toLocaleDateString('en-GB')} · {transaction.category}
                      {transaction.sku ? ` · ${transaction.sku}` : ''}
                    </small>
                  </div>
                  <div className={effect >= 0 ? 'ledger-amount positive' : 'ledger-amount negative'}>
                    {formatFinanceMoney(effect)}
                  </div>
                  <button type="button" className="ledger-delete" onClick={() => deleteTransaction(transaction)} aria-label="Delete transaction">×</button>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {formOpen && (
        <section className="finance-overlay" role="dialog" aria-modal="true" aria-label="Add finance transaction">
          <form className="finance-form" onSubmit={addTransaction}>
            <div className="editor-header">
              <div>
                <p className="eyebrow">NEW LEDGER ENTRY</p>
                <h2>Add transaction</h2>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} aria-label="Close">×</button>
            </div>

            <div className="finance-form-grid">
              <label>Transaction type
                <select value={type} onChange={event => changeType(event.target.value as FinanceTransactionType)}>
                  <option value="sale">Sale income</option>
                  <option value="expense">Business expense</option>
                  <option value="owner-funding">Owner funding</option>
                  <option value="owner-withdrawal">Owner withdrawal</option>
                  <option value="tax-reserve-in">Move to tax reserve</option>
                  <option value="tax-reserve-out">Release tax reserve</option>
                </select>
              </label>
              <label>Date
                <input type="date" value={date} onChange={event => setDate(event.target.value)} />
              </label>
              <label>Category
                <select value={category} onChange={event => setCategory(event.target.value)}>
                  {categories[type].map(value => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label>Amount (£)
                <input inputMode="decimal" type="number" step="0.01" min="0" value={amount} onChange={event => setAmount(event.target.value)} />
              </label>
              <label className="finance-form-full">Description
                <input value={description} onChange={event => setDescription(event.target.value)} placeholder="What was this money for?" />
              </label>
              {type === 'sale' && (
                <label className="finance-form-full">Linked inventory SKU
                  <select value={sku} onChange={event => setSku(event.target.value)}>
                    <option value="">Not linked — profit may be overstated</option>
                    {items.map(item => <option key={item.sku} value={item.sku}>{item.sku} · {item.brand} {item.category}</option>)}
                  </select>
                </label>
              )}
              <label className="finance-form-full">Notes
                <textarea rows={3} value={notes} onChange={event => setNotes(event.target.value)} />
              </label>
            </div>

            <JosButton type="submit" variant="primary" fullWidth>Save transaction</JosButton>
            <JosButton type="button" variant="secondary" fullWidth onClick={() => setFormOpen(false)}>Cancel</JosButton>
          </form>
        </section>
      )}
    </main>
  )
}
