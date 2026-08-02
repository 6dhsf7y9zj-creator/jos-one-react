import { useEffect, useMemo, useState } from 'react'
import type { InventoryItem, StockStatus } from '../types/inventory'
import { expectedProfit, nextStatus } from '../lib/inventory'

type InventoryProps = {
  items: InventoryItem[]
  onUpdate: (item: InventoryItem) => void
  initialStatus?: StockStatus
}

export function Inventory({ items, onUpdate, initialStatus }: InventoryProps) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StockStatus | 'All'>(initialStatus ?? 'All')

  useEffect(() => {
    setStatus(initialStatus ?? 'All')
  }, [initialStatus])

  const filtered = useMemo(() => {
    const normalised = query.trim().toLowerCase()
    return items.filter(item => {
      const matchesStatus = status === 'All' || item.status === status
      const matchesQuery = !normalised ||
        `${item.sku} ${item.brand} ${item.category} ${item.description} ${item.size} ${item.storageLocation}`
          .toLowerCase()
          .includes(normalised)
      return matchesStatus && matchesQuery
    })
  }, [items, query, status])

  const statuses: Array<StockStatus | 'All'> = [
    'All',
    'Prep',
    'Photographed',
    'Live',
    'Sold',
    'Dispatched',
    'Archived',
  ]

  return (
    <main className="screen inventory-screen">
      <section className="inventory-tools">
        <input
          className="search"
          placeholder="Search SKU, brand, item or storage"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        <div className="filter-strip" aria-label="Inventory status filter">
          {statuses.map(option => (
            <button
              type="button"
              key={option}
              className={status === option ? 'active' : ''}
              onClick={() => setStatus(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      <div className="inventory-heading">
        <div>
          <p className="eyebrow">CURRENT VIEW</p>
          <h2>{status === 'All' ? 'All inventory' : `${status} stock`}</h2>
        </div>
        <strong>{filtered.length}</strong>
      </div>

      <div className="inventory-list">
        {filtered.length === 0 ? (
          <section className="empty-state">
            <h3>No matching stock</h3>
            <p>Try another status or change your search.</p>
          </section>
        ) : filtered.map(item => (
          <article className="item-card" key={item.sku}>
            <div className="item-card-top">
              <div>
                <p className="eyebrow">{item.sku}</p>
                <h3>{item.brand} {item.category}</h3>
                <p>{item.description} · {item.size}</p>
              </div>
              <span className={`grade grade-${item.grade.toLowerCase()}`}>{item.grade}</span>
            </div>

            <dl className="item-details">
              <div><dt>Status</dt><dd>{item.status}</dd></div>
              <div><dt>Storage</dt><dd>{item.storageLocation || 'TBC'}</dd></div>
              <div><dt>Cost</dt><dd>£{item.purchasePrice.toFixed(2)}</dd></div>
              <div><dt>Expected profit</dt><dd>£{expectedProfit(item).toFixed(2)}</dd></div>
            </dl>

            {item.status !== 'Archived' && (
              <button
                type="button"
                onClick={() => onUpdate({ ...item, status: nextStatus(item.status) })}
              >
                Move to {nextStatus(item.status)}
              </button>
            )}
          </article>
        ))}
      </div>
    </main>
  )
}
