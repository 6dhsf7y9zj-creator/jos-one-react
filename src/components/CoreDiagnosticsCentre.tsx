import { useMemo, useState } from 'react'
import { useJOSCore } from '../core/CoreProvider.tsx'
import { getBusinessAuditTrail } from '../core/EventBus.ts'
import { inspectRelationships } from '../core/RelationshipEngine.ts'
import { formatFinanceMoney } from '../lib/finance.ts'

type Props = {
  onOpenInventory: (sku: string) => void
}

function formatMetric(value: number, unit: 'GBP' | 'count' | 'percent'): string {
  if (unit === 'GBP') return formatFinanceMoney(value)
  if (unit === 'percent') return `${Math.round(value)}%`
  return String(Math.round(value))
}

export function CoreDiagnosticsCentre({ onOpenInventory }: Props) {
  const { items, orders, settings, systemHealth, dataHub } = useJOSCore()
  const [query, setQuery] = useState('')
  const relationships = useMemo(() => inspectRelationships(items, orders, settings), [items, orders, settings])
  const audit = getBusinessAuditTrail()
  const selected = items.find(item => item.sku.toLowerCase() === query.trim().toLowerCase())
  const handover = selected ? dataHub.inventoryFinance.find(row => row.sku === selected.sku) : undefined
  const linkedOrders = selected ? orders.filter(order => order.sku === selected.sku) : []
  const linkedFinance = selected ? (settings.finance?.transactions ?? []).filter(transaction => transaction.sku === selected.sku) : []
  const metrics = Object.values(dataHub.metrics)

  return (
    <main className="screen core-diagnostics-centre">
      <section className={`diagnostics-hero status-${dataHub.validation}`}>
        <div>
          <p className="eyebrow">JOS CORE · PRODUCTION DIAGNOSTICS</p>
          <h2>{systemHealth.score}/100 system health</h2>
          <p>Data Hub v{dataHub.version} · {dataHub.validation} · refreshed {new Date(dataHub.refreshedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <strong>{systemHealth.errors}<small>errors</small></strong>
      </section>

      <section className="panel diagnostics-panel">
        <p className="eyebrow">PUBLISHED DATA HUB</p>
        <h2>Named business outputs</h2>
        <div className="diagnostics-metric-grid">
          {metrics.map(metric => (
            <article key={metric.key}>
              <span>{metric.key.replaceAll('.', ' ')}</span>
              <strong>{formatMetric(metric.value, metric.unit)}</strong>
              <small>{metric.owner} · {metric.validation}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="panel diagnostics-panel">
        <p className="eyebrow">RELATIONSHIP CONTROL</p>
        <h2>Broken-link inspection</h2>
        <div className="diagnostics-check-grid">
          <article><strong>{relationships.duplicateSkus.length}</strong><span>duplicate SKUs</span></article>
          <article><strong>{relationships.orphanOrderIds.length}</strong><span>orphan orders</span></article>
          <article><strong>{relationships.orphanFinanceTransactionIds.length}</strong><span>orphan finance entries</span></article>
          <article><strong>{relationships.soldItemsWithoutOrderOrSale.length}</strong><span>unsupported sold records</span></article>
        </div>
        {dataHub.issues.length > 0 ? (
          <div className="diagnostics-issues">{dataHub.issues.map(issue => <p key={issue}>! {issue}</p>)}</div>
        ) : <p className="diagnostics-clear">✓ No critical relationship faults detected.</p>}
      </section>

      <section className="panel diagnostics-panel">
        <p className="eyebrow">SKU RELATIONSHIP INSPECTOR</p>
        <h2>Trace one item through JOS</h2>
        <input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Enter an exact SKU" />
        {query && !selected && <p className="diagnostics-empty">No inventory record matches that SKU.</p>}
        {selected && (
          <article className="relationship-card">
            <div><h3>{selected.sku}</h3><p>{selected.brand} · {selected.category} · {selected.status}</p></div>
            <div className="relationship-links">
              <span className="status-pass">✓ Inventory record</span>
              <span className={linkedOrders.length ? 'status-pass' : 'status-warning'}>{linkedOrders.length ? '✓' : '•'} {linkedOrders.length} linked orders</span>
              <span className={linkedFinance.length ? 'status-pass' : 'status-warning'}>{linkedFinance.length ? '✓' : '•'} {linkedFinance.length} finance entries</span>
              <span className={handover?.validation === 'valid' ? 'status-pass' : 'status-warning'}>{handover?.validation === 'valid' ? '✓' : '•'} Data Hub {handover?.validation ?? 'missing'}</span>
            </div>
            {handover?.issues.map(issue => <p className="relationship-warning" key={issue}>! {issue}</p>)}
            <button type="button" className="primary-action" onClick={() => onOpenInventory(selected.sku)}>Open inventory record</button>
          </article>
        )}
      </section>

      <section className="panel diagnostics-panel">
        <p className="eyebrow">AUDIT TRAIL</p>
        <h2>Latest core events</h2>
        {audit.length === 0 ? <p className="diagnostics-empty">No core events have been recorded yet.</p> : (
          <div className="audit-list">
            {audit.slice(0, 20).map(event => (
              <article key={event.id}>
                <time>{new Date(event.occurredAt).toLocaleString('en-GB')}</time>
                <strong>{event.summary}</strong>
                <small>{event.type}{event.entityId ? ` · ${event.entityId}` : ''}</small>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
