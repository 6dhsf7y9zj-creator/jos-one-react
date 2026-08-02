import { useEffect, useMemo, useState } from 'react'
import type { InventoryItem, StockStatus } from '../types/inventory'
import {
  duplicateSkus,
  expectedProfit,
  itemRoi,
  lifecycle,
  nextStatus,
  normaliseInventoryText,
} from '../lib/inventory'

type InventoryProps = {
  items: InventoryItem[]
  onUpdate: (item: InventoryItem) => void
  onUpdateMany: (items: InventoryItem[]) => void
  onDelete: (sku: string) => void
  initialStatus?: StockStatus
}

type SortOption =
  | 'sku'
  | 'brand'
  | 'profit-high'
  | 'cost-high'
  | 'sale-high'
  | 'roi-high'
  | 'status'

type EditableItem = InventoryItem

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))]
    .sort((a, b) => a.localeCompare(b))
}

function csvValue(value: unknown): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function downloadCsv(items: InventoryItem[]): void {
  const headers = [
    'SKU', 'Brand', 'Category', 'Description', 'Department', 'Size', 'Colour',
    'Condition', 'Status', 'Grade', 'Purchase Price', 'Expected Sale',
    'Expected Profit', 'ROI', 'Storage', 'Notes',
  ]
  const rows = items.map(item => [
    item.sku,
    item.brand,
    item.category,
    item.description,
    item.department ?? '',
    item.size,
    item.colour ?? '',
    item.condition,
    item.status,
    item.grade,
    item.purchasePrice.toFixed(2),
    item.expectedSalePrice.toFixed(2),
    expectedProfit(item).toFixed(2),
    itemRoi(item).toFixed(1),
    item.storageLocation,
    item.notes ?? '',
  ])

  const csv = [headers, ...rows].map(row => row.map(csvValue).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `JOS-inventory-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function Inventory({
  items,
  onUpdate,
  onUpdateMany,
  onDelete,
  initialStatus,
}: InventoryProps) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StockStatus | 'All'>(initialStatus ?? 'All')
  const [brand, setBrand] = useState('All')
  const [category, setCategory] = useState('All')
  const [grade, setGrade] = useState<InventoryItem['grade'] | 'All'>('All')
  const [storage, setStorage] = useState('All')
  const [sort, setSort] = useState<SortOption>('sku')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<StockStatus>('Prep')
  const [bulkGrade, setBulkGrade] = useState<InventoryItem['grade']>('B')
  const [bulkStorage, setBulkStorage] = useState('')
  const [editing, setEditing] = useState<EditableItem | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setStatus(initialStatus ?? 'All')
  }, [initialStatus])

  useEffect(() => {
    setSelected(current => current.filter(sku => items.some(item => item.sku === sku)))
  }, [items])

  const duplicateSkuList = useMemo(() => duplicateSkus(items), [items])
  const brands = useMemo(() => unique(items.map(item => item.brand)), [items])
  const categories = useMemo(() => unique(items.map(item => item.category)), [items])
  const storageLocations = useMemo(
    () => unique(items.map(item => item.storageLocation)),
    [items],
  )

  const filtered = useMemo(() => {
    const normalised = query.trim().toLowerCase()

    const matching = items.filter(item => {
      return (
        (status === 'All' || item.status === status) &&
        (brand === 'All' || item.brand === brand) &&
        (category === 'All' || item.category === category) &&
        (grade === 'All' || item.grade === grade) &&
        (storage === 'All' || item.storageLocation === storage) &&
        (!normalised || normaliseInventoryText(item).includes(normalised))
      )
    })

    return [...matching].sort((a, b) => {
      switch (sort) {
        case 'brand':
          return `${a.brand} ${a.description}`.localeCompare(`${b.brand} ${b.description}`)
        case 'profit-high':
          return expectedProfit(b) - expectedProfit(a)
        case 'cost-high':
          return b.purchasePrice - a.purchasePrice
        case 'sale-high':
          return b.expectedSalePrice - a.expectedSalePrice
        case 'roi-high':
          return itemRoi(b) - itemRoi(a)
        case 'status':
          return lifecycle.indexOf(a.status) - lifecycle.indexOf(b.status)
        default:
          return a.sku.localeCompare(b.sku, undefined, { numeric: true })
      }
    })
  }, [items, query, status, brand, category, grade, storage, sort])

  const totals = useMemo(() => {
    const cost = filtered.reduce((sum, item) => sum + item.purchasePrice, 0)
    const expectedSale = filtered.reduce((sum, item) => sum + item.expectedSalePrice, 0)
    const profit = filtered.reduce((sum, item) => sum + expectedProfit(item), 0)
    return {
      cost,
      expectedSale,
      profit,
      averageRoi: filtered.length
        ? filtered.reduce((sum, item) => sum + itemRoi(item), 0) / filtered.length
        : 0,
    }
  }, [filtered])

  const activeFilters = [
    status !== 'All',
    brand !== 'All',
    category !== 'All',
    grade !== 'All',
    storage !== 'All',
  ].filter(Boolean).length

  const statuses: Array<StockStatus | 'All'> = [
    'All',
    'Prep',
    'Photographed',
    'Live',
    'Sold',
    'Dispatched',
    'Archived',
  ]

  const clearFilters = () => {
    setQuery('')
    setStatus('All')
    setBrand('All')
    setCategory('All')
    setGrade('All')
    setStorage('All')
    setSort('sku')
  }

  const toggleSelected = (sku: string) => {
    setSelected(current =>
      current.includes(sku)
        ? current.filter(value => value !== sku)
        : [...current, sku],
    )
  }

  const selectAllVisible = () => {
    const visibleSkus = filtered.map(item => item.sku)
    const allSelected = visibleSkus.every(sku => selected.includes(sku))
    setSelected(current =>
      allSelected
        ? current.filter(sku => !visibleSkus.includes(sku))
        : [...new Set([...current, ...visibleSkus])],
    )
  }

  const applyBulk = (
    changes: Partial<Pick<InventoryItem, 'status' | 'grade' | 'storageLocation'>>,
    label: string,
  ) => {
    const changed = items
      .filter(item => selected.includes(item.sku))
      .map(item => ({ ...item, ...changes }))
    if (!changed.length) return
    onUpdateMany(changed)
    setNotice(`${changed.length} item${changed.length === 1 ? '' : 's'} ${label}.`)
    setSelected([])
  }

  const saveEdit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing) return
    if (
      !editing.brand.trim() ||
      !editing.description.trim() ||
      editing.purchasePrice < 0 ||
      editing.expectedSalePrice < 0
    ) {
      setNotice('Brand, description and valid prices are required.')
      return
    }
    onUpdate({
      ...editing,
      brand: editing.brand.trim(),
      category: editing.category.trim(),
      description: editing.description.trim(),
      size: editing.size.trim() || 'N/A',
      storageLocation: editing.storageLocation.trim() || 'TBC',
    })
    setNotice(`${editing.sku} updated.`)
    setEditing(null)
  }

  const deleteItem = (item: InventoryItem) => {
    if (
      !window.confirm(
        `Delete ${item.sku} — ${item.brand} ${item.category}? Automatic Backup will preserve a recoverable snapshot.`,
      )
    ) return
    onDelete(item.sku)
    setEditing(null)
    setNotice(`${item.sku} deleted. It can be recovered from Backup Centre.`)
  }

  return (
    <main className="screen inventory-command-centre">
      <section className="inventory-command-summary">
        <div>
          <p className="eyebrow">INVENTORY COMMAND CENTRE</p>
          <h2>{filtered.length} items in view</h2>
          <p>Search, control and progress every stock item from one screen.</p>
        </div>
        <button type="button" className="inventory-export" onClick={() => downloadCsv(filtered)}>
          Export CSV
        </button>
      </section>

      <section className="inventory-kpis" aria-label="Current inventory totals">
        <div><span>Stock cost</span><strong>£{totals.cost.toFixed(2)}</strong></div>
        <div><span>Expected sales</span><strong>£{totals.expectedSale.toFixed(2)}</strong></div>
        <div><span>Expected profit</span><strong>£{totals.profit.toFixed(2)}</strong></div>
        <div><span>Average ROI</span><strong>{totals.averageRoi.toFixed(0)}%</strong></div>
      </section>

      {duplicateSkuList.length > 0 && (
        <section className="inventory-warning">
          <strong>Duplicate SKU warning</strong>
          <span>{duplicateSkuList.join(', ')}</span>
        </section>
      )}

      {notice && (
        <button type="button" className="inventory-notice" onClick={() => setNotice('')}>
          {notice} <span>×</span>
        </button>
      )}

      <section className="inventory-tools command-tools">
        <input
          className="search"
          placeholder="Search SKU, brand, item, size, notes or storage"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />

        <div className="inventory-tool-row">
          <button
            type="button"
            className={`filter-toggle ${filtersOpen ? 'active' : ''}`}
            onClick={() => setFiltersOpen(value => !value)}
          >
            Filters {activeFilters > 0 ? `(${activeFilters})` : ''}
          </button>
          <select value={sort} onChange={event => setSort(event.target.value as SortOption)} aria-label="Sort inventory">
            <option value="sku">Sort: SKU</option>
            <option value="brand">Sort: Brand</option>
            <option value="profit-high">Profit: High to low</option>
            <option value="roi-high">ROI: High to low</option>
            <option value="cost-high">Cost: High to low</option>
            <option value="sale-high">Sale price: High to low</option>
            <option value="status">Workflow stage</option>
          </select>
        </div>

        <div className="filter-strip" aria-label="Inventory status filter">
          {statuses.map(option => (
            <button
              type="button"
              key={option}
              className={status === option ? 'active' : ''}
              onClick={() => setStatus(option)}
            >
              {option}
              <small>
                {option === 'All'
                  ? items.length
                  : items.filter(item => item.status === option).length}
              </small>
            </button>
          ))}
        </div>

        {filtersOpen && (
          <div className="advanced-filters">
            <label>Brand
              <select value={brand} onChange={event => setBrand(event.target.value)}>
                <option>All</option>
                {brands.map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>Category
              <select value={category} onChange={event => setCategory(event.target.value)}>
                <option>All</option>
                {categories.map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>Grade
              <select
                value={grade}
                onChange={event => setGrade(event.target.value as InventoryItem['grade'] | 'All')}
              >
                <option>All</option>
                <option>A</option><option>B</option><option>C</option><option>Exit</option>
              </select>
            </label>
            <label>Storage
              <select value={storage} onChange={event => setStorage(event.target.value)}>
                <option>All</option>
                {storageLocations.map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
            <button type="button" className="clear-filter" onClick={clearFilters}>Clear all</button>
          </div>
        )}
      </section>

      <section className="bulk-command-bar">
        <label>
          <input
            type="checkbox"
            checked={filtered.length > 0 && filtered.every(item => selected.includes(item.sku))}
            onChange={selectAllVisible}
          />
          Select visible
        </label>
        <strong>{selected.length} selected</strong>
        {selected.length > 0 && (
          <button type="button" onClick={() => setSelected([])}>Clear</button>
        )}
      </section>

      {selected.length > 0 && (
        <section className="bulk-controls">
          <div>
            <select value={bulkStatus} onChange={event => setBulkStatus(event.target.value as StockStatus)}>
              {lifecycle.map(value => <option key={value}>{value}</option>)}
            </select>
            <button type="button" onClick={() => applyBulk({ status: bulkStatus }, `moved to ${bulkStatus}`)}>
              Set status
            </button>
          </div>
          <div>
            <select value={bulkGrade} onChange={event => setBulkGrade(event.target.value as InventoryItem['grade'])}>
              <option>A</option><option>B</option><option>C</option><option>Exit</option>
            </select>
            <button type="button" onClick={() => applyBulk({ grade: bulkGrade }, `set to Grade ${bulkGrade}`)}>
              Set grade
            </button>
          </div>
          <div>
            <input
              value={bulkStorage}
              onChange={event => setBulkStorage(event.target.value)}
              placeholder="Storage location"
            />
            <button
              type="button"
              disabled={!bulkStorage.trim()}
              onClick={() => applyBulk({ storageLocation: bulkStorage.trim() }, `moved to ${bulkStorage.trim()}`)}
            >
              Set storage
            </button>
          </div>
        </section>
      )}

      <div className="inventory-list command-list">
        {filtered.length === 0 ? (
          <section className="empty-state panel">
            <h3>No matching stock</h3>
            <p>Try another status, clear the filters or change the search.</p>
            <button type="button" onClick={clearFilters}>Show all inventory</button>
          </section>
        ) : filtered.map(item => {
          const profit = expectedProfit(item)
          const roi = itemRoi(item)
          const isSelected = selected.includes(item.sku)

          return (
            <article className={`item-card command-item-card ${isSelected ? 'selected' : ''}`} key={item.sku}>
              <div className="item-selection">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelected(item.sku)}
                  aria-label={`Select ${item.sku}`}
                />
              </div>

              <button type="button" className="item-open" onClick={() => setEditing({ ...item })}>
                <div className="item-card-top">
                  <div>
                    <p className="eyebrow">{item.sku}</p>
                    <h3>{item.brand} {item.category}</h3>
                    <p>{item.description} · {item.size}</p>
                  </div>
                  <span className={`grade grade-${item.grade.toLowerCase()}`}>{item.grade}</span>
                </div>

                <div className="item-status-line">
                  <span className={`status-pill status-${item.status.toLowerCase()}`}>{item.status}</span>
                  <span>{item.storageLocation || 'TBC'}</span>
                </div>

                <dl className="command-item-metrics">
                  <div><dt>Cost</dt><dd>£{item.purchasePrice.toFixed(2)}</dd></div>
                  <div><dt>Expected sale</dt><dd>£{item.expectedSalePrice.toFixed(2)}</dd></div>
                  <div><dt>Profit</dt><dd className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>£{profit.toFixed(2)}</dd></div>
                  <div><dt>ROI</dt><dd>{roi.toFixed(0)}%</dd></div>
                </dl>
              </button>

              <div className="item-quick-actions">
                <button type="button" onClick={() => setEditing({ ...item })}>View / Edit</button>
                {item.status !== 'Archived' && (
                  <button
                    type="button"
                    className="advance-action"
                    onClick={() => onUpdate({ ...item, status: nextStatus(item.status) })}
                  >
                    Move to {nextStatus(item.status)}
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {editing && (
        <section className="inventory-editor-overlay" role="dialog" aria-modal="true" aria-label={`Edit ${editing.sku}`}>
          <form className="inventory-editor" onSubmit={saveEdit}>
            <div className="editor-header">
              <div>
                <p className="eyebrow">{editing.sku}</p>
                <h2>Item details</h2>
              </div>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close editor">×</button>
            </div>

            <div className="editor-profit-summary">
              <div><span>Expected profit</span><strong>£{expectedProfit(editing).toFixed(2)}</strong></div>
              <div><span>ROI</span><strong>{itemRoi(editing).toFixed(0)}%</strong></div>
            </div>

            <div className="editor-grid">
              <label>Brand<input value={editing.brand} onChange={event => setEditing({ ...editing, brand: event.target.value })} /></label>
              <label>Category<input value={editing.category} onChange={event => setEditing({ ...editing, category: event.target.value })} /></label>
              <label className="editor-full">Description<input value={editing.description} onChange={event => setEditing({ ...editing, description: event.target.value })} /></label>
              <label>Department<input value={editing.department ?? ''} onChange={event => setEditing({ ...editing, department: event.target.value })} /></label>
              <label>Size<input value={editing.size} onChange={event => setEditing({ ...editing, size: event.target.value })} /></label>
              <label>Colour<input value={editing.colour ?? ''} onChange={event => setEditing({ ...editing, colour: event.target.value })} /></label>
              <label>Condition<input value={editing.condition} onChange={event => setEditing({ ...editing, condition: event.target.value })} /></label>
              <label>Status
                <select value={editing.status} onChange={event => setEditing({ ...editing, status: event.target.value as StockStatus })}>
                  {lifecycle.map(value => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label>Grade
                <select value={editing.grade} onChange={event => setEditing({ ...editing, grade: event.target.value as InventoryItem['grade'] })}>
                  <option>A</option><option>B</option><option>C</option><option>Exit</option>
                </select>
              </label>
              <label>Purchase price (£)<input inputMode="decimal" type="number" step="0.01" min="0" value={editing.purchasePrice} onChange={event => setEditing({ ...editing, purchasePrice: Number(event.target.value) })} /></label>
              <label>Expected sale (£)<input inputMode="decimal" type="number" step="0.01" min="0" value={editing.expectedSalePrice} onChange={event => setEditing({ ...editing, expectedSalePrice: Number(event.target.value) })} /></label>
              <label>Actual sale (£)<input inputMode="decimal" type="number" step="0.01" min="0" value={editing.actualSalePrice ?? ''} onChange={event => setEditing({ ...editing, actualSalePrice: event.target.value ? Number(event.target.value) : undefined })} /></label>
              <label>Storage<input value={editing.storageLocation} onChange={event => setEditing({ ...editing, storageLocation: event.target.value })} /></label>
              <label className="editor-full">Notes<textarea rows={4} value={editing.notes ?? ''} onChange={event => setEditing({ ...editing, notes: event.target.value })} /></label>
            </div>

            <div className="editor-actions">
              <button type="submit" className="primary-action">Save changes</button>
              <button type="button" className="secondary-action" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="delete-item-action" onClick={() => deleteItem(editing)}>Delete item</button>
            </div>
          </form>
        </section>
      )}
    </main>
  )
}
