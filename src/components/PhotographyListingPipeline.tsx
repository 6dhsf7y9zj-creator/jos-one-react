import { useMemo, useState } from 'react'
import type {
  InventoryItem,
  ListingChecklist,
  ListingPipelineStage,
  PhotoChecklist,
} from '../types/inventory'
import {
  advancePipeline,
  inferPipelineStage,
  listingCompletion,
  normalisePipelineItem,
  photoCompletion,
  pipelineBottleneck,
  pipelineReadiness,
  pipelineStages,
  stageToStockStatus,
} from '../lib/pipeline'
import { expectedProfit } from '../lib/inventory'

type Props = {
  items: InventoryItem[]
  onUpdate: (item: InventoryItem) => void
  onUpdateMany: (items: InventoryItem[]) => void
}

type ChecklistKey = keyof PhotoChecklist | keyof ListingChecklist

const photoLabels: Record<keyof PhotoChecklist, string> = {
  front: 'Front',
  back: 'Back',
  brandLabel: 'Brand label',
  sizeLabel: 'Size label',
  careLabel: 'Care label',
  measurements: 'Measurements',
  defects: 'Defects / condition',
}

const listingLabels: Record<keyof ListingChecklist, string> = {
  title: 'Title written',
  description: 'Description written',
  measurements: 'Measurements added',
  condition: 'Condition checked',
  price: 'Price confirmed',
  platform: 'Platform selected',
}

export function PhotographyListingPipeline({ items, onUpdate, onUpdateMany }: Props) {
  const [stage, setStage] = useState<ListingPipelineStage | 'All'>('All')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [message, setMessage] = useState('')

  const normalisedItems = useMemo(() => items.map(normalisePipelineItem), [items])
  const activeItems = normalisedItems.filter(item => !['Sold', 'Dispatched', 'Archived'].includes(item.status))
  const bottleneck = pipelineBottleneck(activeItems)
  const filtered = activeItems
    .filter(item => stage === 'All' || inferPipelineStage(item) === stage)
    .filter(item => {
      const term = query.trim().toLowerCase()
      return !term || [item.sku, item.brand, item.category, item.description, item.size]
        .join(' ').toLowerCase().includes(term)
    })
    .sort((a, b) => pipelineReadiness(a) - pipelineReadiness(b))

  const stageCounts = pipelineStages.map(value => ({
    stage: value,
    count: activeItems.filter(item => inferPipelineStage(item) === value).length,
  }))

  const updateChecklist = (
    item: InventoryItem,
    kind: 'photo' | 'listing',
    key: ChecklistKey,
    value: boolean,
  ) => {
    const normalised = normalisePipelineItem(item)
    const updated = kind === 'photo'
      ? {
          ...normalised,
          photoChecklist: { ...normalised.photoChecklist!, [key]: value },
        }
      : {
          ...normalised,
          listingChecklist: { ...normalised.listingChecklist!, [key]: value },
        }
    setEditing(updated)
  }

  const saveEditor = () => {
    if (!editing) return
    const updated = normalisePipelineItem(editing)
    onUpdate(updated)
    setMessage(`${updated.sku} pipeline record updated.`)
    setEditing(null)
  }

  const advance = (item: InventoryItem) => {
    const updated = advancePipeline(item)
    onUpdate(updated)
    setMessage(`${updated.sku} moved to ${updated.pipelineStage}.`)
  }

  const moveVisibleForward = () => {
    const eligible = filtered.filter(item => inferPipelineStage(item) !== 'Live')
    if (!eligible.length) return
    if (!window.confirm(`Move ${eligible.length} visible item${eligible.length === 1 ? '' : 's'} forward one stage?`)) return
    onUpdateMany(eligible.map(advancePipeline))
    setMessage(`${eligible.length} items moved forward.`)
  }

  const setEditorStage = (value: ListingPipelineStage) => {
    if (!editing) return
    setEditing({
      ...editing,
      pipelineStage: value,
      status: stageToStockStatus(value, editing.status),
      dateListed: value === 'Live' && !editing.dateListed
        ? new Date().toISOString().slice(0, 10)
        : editing.dateListed,
    })
  }

  return (
    <main className="screen pipeline-command-centre">
      <section className="pipeline-hero">
        <div>
          <p className="eyebrow">PHOTOGRAPHY & LISTING PIPELINE</p>
          <h2>Turn sourced stock into live listings</h2>
          <p>Track every operational step without changing your core inventory record.</p>
        </div>
        <div className="pipeline-bottleneck">
          <span>Current bottleneck</span>
          <strong>{bottleneck.stage}</strong>
          <small>{bottleneck.count} items waiting</small>
        </div>
      </section>

      {message && (
        <button type="button" className="pipeline-message" onClick={() => setMessage('')}>
          {message}<span>×</span>
        </button>
      )}

      <section className="pipeline-kpis">
        {stageCounts.map(value => (
          <button type="button" key={value.stage} onClick={() => setStage(value.stage)}>
            <span>{value.stage}</span>
            <strong>{value.count}</strong>
          </button>
        ))}
      </section>

      <section className="panel pipeline-controls">
        <input
          className="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search SKU, brand, item or size"
        />
        <div className="pipeline-stage-filter">
          <button type="button" className={stage === 'All' ? 'active' : ''} onClick={() => setStage('All')}>All</button>
          {pipelineStages.map(value => (
            <button type="button" className={stage === value ? 'active' : ''} key={value} onClick={() => setStage(value)}>
              {value}
            </button>
          ))}
        </div>
        <button type="button" className="pipeline-bulk-action" onClick={moveVisibleForward}>
          Move visible items forward
        </button>
      </section>

      <section className="pipeline-list">
        {filtered.length === 0 ? (
          <div className="panel empty-state">
            <h3>No matching pipeline items</h3>
            <p>Clear the search or choose another workflow stage.</p>
          </div>
        ) : filtered.map(item => {
          const currentStage = inferPipelineStage(item)
          const readiness = pipelineReadiness(item)
          return (
            <article className="pipeline-card" key={item.sku}>
              <div className="pipeline-card-heading">
                <div>
                  <p className="eyebrow">{item.sku}</p>
                  <h3>{item.brand} {item.category}</h3>
                  <p>{item.description} · {item.size}</p>
                </div>
                <span className="pipeline-readiness">{readiness}%</span>
              </div>

              <div className="pipeline-stage-badge">{currentStage}</div>

              <div className="pipeline-progress">
                <div>
                  <span>Photography</span>
                  <strong>{photoCompletion(item)}%</strong>
                  <progress max="100" value={photoCompletion(item)} />
                </div>
                <div>
                  <span>Listing copy</span>
                  <strong>{listingCompletion(item)}%</strong>
                  <progress max="100" value={listingCompletion(item)} />
                </div>
              </div>

              <div className="pipeline-value">
                <span>Expected profit</span>
                <strong>£{expectedProfit(item).toFixed(2)}</strong>
                <span>{item.platform || 'Platform not selected'}</span>
              </div>

              <div className="pipeline-card-actions">
                <button type="button" onClick={() => setEditing(normalisePipelineItem(item))}>Open checklist</button>
                {currentStage !== 'Live' && (
                  <button type="button" className="pipeline-primary" onClick={() => advance(item)}>
                    Move to {pipelineStages[pipelineStages.indexOf(currentStage) + 1]}
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </section>

      {editing && (
        <section className="pipeline-overlay" role="dialog" aria-modal="true" aria-label={`Pipeline details for ${editing.sku}`}>
          <div className="pipeline-editor">
            <div className="editor-header">
              <div>
                <p className="eyebrow">{editing.sku}</p>
                <h2>{editing.brand} {editing.category}</h2>
              </div>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close">×</button>
            </div>

            <div className="pipeline-editor-summary">
              <div><span>Readiness</span><strong>{pipelineReadiness(editing)}%</strong></div>
              <label>Current stage
                <select value={inferPipelineStage(editing)} onChange={event => setEditorStage(event.target.value as ListingPipelineStage)}>
                  {pipelineStages.map(value => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label>Target platform
                <input value={editing.platform ?? ''} onChange={event => setEditing({ ...editing, platform: event.target.value })} placeholder="Vinted" />
              </label>
            </div>

            <section className="pipeline-checklist-section">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">PHOTO CHECKLIST</p>
                  <h3>{photoCompletion(editing)}% complete</h3>
                </div>
              </div>
              <div className="pipeline-checklist">
                {(Object.keys(photoLabels) as Array<keyof PhotoChecklist>).map(key => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={editing.photoChecklist?.[key] ?? false}
                      onChange={event => updateChecklist(editing, 'photo', key, event.target.checked)}
                    />
                    <span>{photoLabels[key]}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="pipeline-checklist-section">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">LISTING CHECKLIST</p>
                  <h3>{listingCompletion(editing)}% complete</h3>
                </div>
              </div>
              <div className="pipeline-checklist">
                {(Object.keys(listingLabels) as Array<keyof ListingChecklist>).map(key => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={editing.listingChecklist?.[key] ?? false}
                      onChange={event => updateChecklist(editing, 'listing', key, event.target.checked)}
                    />
                    <span>{listingLabels[key]}</span>
                  </label>
                ))}
              </div>
            </section>

            <div className="pipeline-editor-actions">
              <button type="button" className="primary-action" onClick={saveEditor}>Save pipeline record</button>
              <button type="button" className="secondary-action" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
