import { useEffect, useMemo, useState } from 'react'
import type { InventoryItem, JosSettings, ListingPipelineStage, StockStatus } from '../types/inventory'
import { expectedProfit, itemRoi } from '../lib/inventory'
import { JosButton, NoticeCard, SectionHeader } from '../ui'

type Props = {
  item: InventoryItem
  items: InventoryItem[]
  settings: JosSettings
  onSave: (originalSku: string, item: InventoryItem) => void
  onDelete: (sku: string) => void
  onCancel: () => void
  onMove: (sku: string) => void
}

type EditableItem = InventoryItem

const statuses: StockStatus[] = ['Prep', 'Photographed', 'Live', 'Sold', 'Dispatched', 'Archived']
const grades: InventoryItem['grade'][] = ['A', 'B', 'C', 'Exit']
const pipelineStages: ListingPipelineStage[] = [
  'Preparation',
  'Photography',
  'Photo Review',
  'Listing Copy',
  'Ready to Upload',
  'Live',
]

function normalised(item: InventoryItem): InventoryItem {
  return {
    ...item,
    sku: item.sku.trim(),
    brand: item.brand.trim(),
    category: item.category.trim(),
    description: item.description.trim(),
    size: item.size.trim() || 'N/A',
    condition: item.condition.trim(),
    department: item.department?.trim() || undefined,
    colour: item.colour?.trim() || undefined,
    platform: item.platform?.trim() || undefined,
    storageLocation: item.storageLocation.trim() || 'TBC',
    notes: item.notes?.trim() || undefined,
  }
}

function margin(item: InventoryItem): number {
  return item.expectedSalePrice > 0
    ? (expectedProfit(item) / item.expectedSalePrice) * 100
    : 0
}

export function InventoryEditCentre({
  item,
  items,
  settings,
  onSave,
  onDelete,
  onCancel,
  onMove,
}: Props) {
  const originalSku = item.sku
  const [editing, setEditing] = useState<EditableItem>({ ...item })
  const [message, setMessage] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    setEditing({ ...item })
    setMessage('')
    setDeleteOpen(false)
  }, [item])

  const dirty = useMemo(
    () => JSON.stringify(editing) !== JSON.stringify(item),
    [editing, item],
  )

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const duplicateSku = useMemo(
    () => items.some(candidate => candidate.sku !== originalSku && candidate.sku.trim().toLowerCase() === editing.sku.trim().toLowerCase()),
    [items, originalSku, editing.sku],
  )

  const currentIndex = items.findIndex(candidate => candidate.sku === originalSku)
  const previous = currentIndex > 0 ? items[currentIndex - 1] : undefined
  const next = currentIndex >= 0 && currentIndex < items.length - 1 ? items[currentIndex + 1] : undefined
  const profit = expectedProfit(editing)
  const roi = itemRoi(editing)
  const targetProfitMiss = profit < settings.minimumProfit
  const targetRoiMiss = roi < settings.targetRoi

  const requestLeave = (action: () => void) => {
    if (dirty && !window.confirm('Discard the unsaved changes to this item?')) return
    action()
  }

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextItem = normalised(editing)
    if (!nextItem.sku || !nextItem.brand || !nextItem.category || !nextItem.description || !nextItem.condition) {
      setMessage('SKU, brand, category, description and condition are required.')
      return
    }
    if (nextItem.purchasePrice < 0 || nextItem.expectedSalePrice < 0 || (nextItem.actualSalePrice ?? 0) < 0) {
      setMessage('Prices cannot be negative.')
      return
    }
    if (duplicateSku) {
      setMessage(`SKU ${nextItem.sku} is already used by another inventory item.`)
      return
    }
    onSave(originalSku, nextItem)
  }

  const change = <K extends keyof EditableItem>(key: K, value: EditableItem[K]) => {
    setEditing(current => ({ ...current, [key]: value }))
  }

  return (
    <main className="screen inventory-edit-centre">
      <section className="iec-hero">
        <div>
          <p className="eyebrow">INVENTORY EDIT CENTRE</p>
          <h2>{editing.brand || 'Untitled item'}</h2>
          <p>{originalSku} · Edit the full stock record without opening a modal.</p>
        </div>
        <button type="button" className="iec-close" onClick={() => requestLeave(onCancel)} aria-label="Return to inventory">×</button>
      </section>

      {message && <NoticeCard title={message} tone="urgent" onDismiss={() => setMessage('')} />}
      {duplicateSku && <NoticeCard title="Duplicate SKU" tone="urgent">Another item already uses {editing.sku || 'this SKU'}.</NoticeCard>}

      <section className="iec-metric-grid" aria-label="Live item calculations">
        <div><span>Purchase cost</span><strong>£{editing.purchasePrice.toFixed(2)}</strong></div>
        <div><span>Expected profit</span><strong className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>£{profit.toFixed(2)}</strong></div>
        <div><span>ROI</span><strong>{roi.toFixed(0)}%</strong></div>
        <div><span>Margin</span><strong>{margin(editing).toFixed(0)}%</strong></div>
      </section>

      {(targetProfitMiss || targetRoiMiss) && (
        <NoticeCard title="Target warning" tone="warning">
          {targetProfitMiss && `Expected profit is below the £${settings.minimumProfit.toFixed(2)} minimum. `}
          {targetRoiMiss && `ROI is below the ${settings.targetRoi.toFixed(0)}% target.`}
        </NoticeCard>
      )}

      <form onSubmit={save} className="iec-form">
        <section className="panel iec-section">
          <SectionHeader eyebrow="IDENTITY" title="Item details" compact />
          <div className="iec-grid">
            <label>SKU<input value={editing.sku} onChange={event => change('sku', event.target.value)} autoCapitalize="characters" /></label>
            <label>Brand<input value={editing.brand} onChange={event => change('brand', event.target.value)} /></label>
            <label>Category<input value={editing.category} onChange={event => change('category', event.target.value)} /></label>
            <label>Department<input value={editing.department ?? ''} onChange={event => change('department', event.target.value || undefined)} /></label>
            <label className="iec-full">Description<input value={editing.description} onChange={event => change('description', event.target.value)} /></label>
            <label>Size<input value={editing.size} onChange={event => change('size', event.target.value)} /></label>
            <label>Colour<input value={editing.colour ?? ''} onChange={event => change('colour', event.target.value || undefined)} /></label>
            <label className="iec-full">Condition<input value={editing.condition} onChange={event => change('condition', event.target.value)} /></label>
          </div>
        </section>

        <section className="panel iec-section">
          <SectionHeader eyebrow="COMMERCIAL" title="Pricing and performance" compact />
          <div className="iec-grid">
            <label>Purchase price (£)<input type="number" min="0" step="0.01" inputMode="decimal" value={editing.purchasePrice} onChange={event => change('purchasePrice', Number(event.target.value))} /></label>
            <label>Expected sale (£)<input type="number" min="0" step="0.01" inputMode="decimal" value={editing.expectedSalePrice} onChange={event => change('expectedSalePrice', Number(event.target.value))} /></label>
            <label>Original purchase (£)<input type="number" min="0" step="0.01" inputMode="decimal" value={editing.originalPurchasePrice ?? ''} onChange={event => change('originalPurchasePrice', event.target.value ? Number(event.target.value) : undefined)} /></label>
            <label>Landed cost (£)<input type="number" min="0" step="0.01" inputMode="decimal" value={editing.landedCost ?? ''} onChange={event => change('landedCost', event.target.value ? Number(event.target.value) : undefined)} /></label>
            <label>List price (£)<input type="number" min="0" step="0.01" inputMode="decimal" value={editing.listPrice ?? ''} onChange={event => change('listPrice', event.target.value ? Number(event.target.value) : undefined)} /></label>
            <label>Actual sale (£)<input type="number" min="0" step="0.01" inputMode="decimal" value={editing.actualSalePrice ?? ''} onChange={event => change('actualSalePrice', event.target.value ? Number(event.target.value) : undefined)} /></label>
          </div>
        </section>

        <section className="panel iec-section">
          <SectionHeader eyebrow="WORKFLOW" title="Status, grade and storage" compact />
          <div className="iec-grid">
            <label>Status<select value={editing.status} onChange={event => change('status', event.target.value as StockStatus)}>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Grade<select value={editing.grade} onChange={event => change('grade', event.target.value as InventoryItem['grade'])}>{grades.map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Pipeline stage<select value={editing.pipelineStage ?? ''} onChange={event => change('pipelineStage', event.target.value ? event.target.value as ListingPipelineStage : undefined)}><option value="">Automatic / not set</option>{pipelineStages.map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Platform<input value={editing.platform ?? ''} onChange={event => change('platform', event.target.value || undefined)} /></label>
            <label className="iec-full">Storage location<input list="iec-storage-options" value={editing.storageLocation} onChange={event => change('storageLocation', event.target.value)} /><datalist id="iec-storage-options">{settings.storageLocations.map(value => <option key={value} value={value} />)}</datalist></label>
          </div>
        </section>

        <section className="panel iec-section">
          <SectionHeader eyebrow="DATES" title="Stock and sale timeline" compact />
          <div className="iec-grid">
            <label>Date sourced<input type="date" value={editing.dateSourced ?? ''} onChange={event => change('dateSourced', event.target.value || undefined)} /></label>
            <label>Date listed<input type="date" value={editing.dateListed ?? ''} onChange={event => change('dateListed', event.target.value || undefined)} /></label>
            <label>Date sold<input type="date" value={editing.dateSold ?? ''} onChange={event => change('dateSold', event.target.value || undefined)} /></label>
            <label>Days in stock<input type="number" min="0" step="1" inputMode="numeric" value={editing.daysInStock ?? ''} onChange={event => change('daysInStock', event.target.value ? Number(event.target.value) : undefined)} /></label>
          </div>
        </section>

        <section className="panel iec-section">
          <SectionHeader eyebrow="INTERNAL RECORD" title="Notes and next action" compact />
          <div className="iec-grid">
            <label className="iec-full">Next action<input value={editing.action ?? ''} onChange={event => change('action', event.target.value || undefined)} /></label>
            <label className="iec-full">Internal notes<textarea rows={5} value={editing.notes ?? ''} onChange={event => change('notes', event.target.value || undefined)} /></label>
          </div>
        </section>

        <section className="iec-record-navigation" aria-label="Move between inventory items">
          <JosButton type="button" variant="ghost" disabled={!previous} onClick={() => previous && requestLeave(() => onMove(previous.sku))}>← Previous</JosButton>
          <span>{currentIndex >= 0 ? `${currentIndex + 1} of ${items.length}` : originalSku}</span>
          <JosButton type="button" variant="ghost" disabled={!next} onClick={() => next && requestLeave(() => onMove(next.sku))}>Next →</JosButton>
        </section>

        <div className="iec-sticky-actions">
          <JosButton type="button" variant="secondary" onClick={() => requestLeave(onCancel)}>Cancel</JosButton>
          <JosButton type="submit" variant="primary" disabled={duplicateSku}>Save changes</JosButton>
        </div>
      </form>

      <section className="panel iec-danger-zone">
        <SectionHeader eyebrow="DANGER ZONE" title="Delete inventory record" compact />
        {!deleteOpen ? (
          <button type="button" className="delete-item-action" onClick={() => setDeleteOpen(true)}>Delete item</button>
        ) : (
          <div className="iec-delete-confirm">
            <p>Delete {originalSku}? Automatic Backup may preserve a recoverable snapshot, but this removes the live record.</p>
            <JosButton variant="secondary" onClick={() => setDeleteOpen(false)}>Keep item</JosButton>
            <button type="button" className="delete-item-action" onClick={() => onDelete(originalSku)}>Confirm delete</button>
          </div>
        )}
      </section>
    </main>
  )
}
