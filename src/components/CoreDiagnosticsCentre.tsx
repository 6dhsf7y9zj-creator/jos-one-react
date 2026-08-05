import { useEffect, useMemo, useState } from 'react'
import { useJOSCore } from '../core/CoreProvider.tsx'
import {
  clearBusinessAuditTrail,
  getBusinessAuditTrail,
  publishBusinessEvent,
  subscribeBusinessEvents,
} from '../core/EventBus.ts'
import { inspectRelationships } from '../core/RelationshipEngine.ts'
import { calculateReliability } from '../core/Reliability.ts'
import { formatFinanceMoney } from '../lib/finance.ts'
import type { BusinessEvent } from '../core/BusinessEvents.ts'

type Props = {
  onOpenInventory: (sku: string) => void
  onOpenBackup: () => void
}

function formatMetric(value: number, unit: 'GBP' | 'count' | 'percent'): string {
  if (unit === 'GBP') return formatFinanceMoney(value)
  if (unit === 'percent') return `${Math.round(value)}%`
  return String(Math.round(value))
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function downloadFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function auditCsv(events: BusinessEvent[]): string {
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  return [
    ['occurredAt', 'type', 'entityId', 'summary'].map(escape).join(','),
    ...events.map(event => [event.occurredAt, event.type, event.entityId ?? '', event.summary].map(escape).join(',')),
  ].join('\n')
}

export function CoreDiagnosticsCentre({ onOpenInventory, onOpenBackup }: Props) {
  const { items, orders, settings, systemHealth, dataHub } = useJOSCore()
  const [query, setQuery] = useState('')
  const [auditQuery, setAuditQuery] = useState('')
  const [audit, setAudit] = useState<BusinessEvent[]>(() => getBusinessAuditTrail())
  const relationships = useMemo(() => inspectRelationships(items, orders, settings), [items, orders, settings])
  const reliability = useMemo(() => calculateReliability(items, orders, settings), [items, orders, settings, audit.length])
  const selected = items.find(item => item.sku.toLowerCase() === query.trim().toLowerCase())
  const handover = selected ? dataHub.inventoryFinance.find(row => row.sku === selected.sku) : undefined
  const linkedOrders = selected ? orders.filter(order => order.sku === selected.sku) : []
  const linkedFinance = selected ? (settings.finance?.transactions ?? []).filter(transaction => transaction.sku === selected.sku) : []
  const metrics = Object.values(dataHub.metrics)
  const visibleAudit = audit.filter(event => {
    const search = auditQuery.trim().toLowerCase()
    return !search || `${event.type} ${event.entityId ?? ''} ${event.summary}`.toLowerCase().includes(search)
  })

  useEffect(() => subscribeBusinessEvents(() => setAudit(getBusinessAuditTrail())), [])

  const runCheck = () => {
    publishBusinessEvent({
      type: 'diagnostics.checked',
      summary: `Ran production integrity check · ${systemHealth.errors} errors · ${reliability.score}/100 reliability`,
      metadata: { systemHealth: systemHealth.score, reliability: reliability.score },
    })
    setAudit(getBusinessAuditTrail())
  }

  const exportAudit = (format: 'json' | 'csv') => {
    const date = new Date().toISOString().slice(0, 10)
    if (format === 'json') downloadFile(JSON.stringify(audit, null, 2), `JOS-audit-${date}.json`, 'application/json')
    else downloadFile(auditCsv(audit), `JOS-audit-${date}.csv`, 'text/csv')
    publishBusinessEvent({ type: 'audit.exported', summary: `Exported ${audit.length} audit events as ${format.toUpperCase()}` })
    setAudit(getBusinessAuditTrail())
  }

  const clearAudit = () => {
    if (!window.confirm('Clear the local JOS audit trail? Export it first if you need a permanent record.')) return
    clearBusinessAuditTrail()
    publishBusinessEvent({ type: 'audit.cleared', summary: 'Cleared local audit trail' })
    setAudit(getBusinessAuditTrail())
  }

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

      <section className={`panel reliability-panel reliability-${reliability.status}`}>
        <p className="eyebrow">SPRINT 4 · RELIABILITY & RECOVERY</p>
        <div className="reliability-heading">
          <div><h2>{reliability.score}/100 production protection</h2><p>Backups, off-device recovery, relationship integrity and local storage.</p></div>
          <strong>{reliability.status}</strong>
        </div>
        <div className="diagnostics-check-grid">
          <article><strong>{reliability.autoBackupCount}</strong><span>local snapshots</span></article>
          <article><strong>{reliability.verifiedRelationshipFaults}</strong><span>relationship faults</span></article>
          <article><strong>{formatBytes(reliability.backupBytes)}</strong><span>backup storage</span></article>
          <article><strong>{formatBytes(reliability.localStorageBytes)}</strong><span>total local data</span></article>
        </div>
        {reliability.issues.length ? <div className="diagnostics-issues">{reliability.issues.map(issue => <p key={issue}>! {issue}</p>)}</div> : <p className="diagnostics-clear">✓ Recovery controls are operating within target.</p>}
        <div className="diagnostics-actions">
          <button type="button" className="primary-action" onClick={runCheck}>Run integrity check</button>
          <button type="button" className="secondary-action" onClick={onOpenBackup}>Open Backup Centre</button>
        </div>
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
        <h2>Searchable production history</h2>
        <input className="search" value={auditQuery} onChange={event => setAuditQuery(event.target.value)} placeholder="Search SKU, event or action" />
        <div className="audit-toolbar">
          <span>{visibleAudit.length} of {audit.length} events · {formatBytes(reliability.auditBytes)}</span>
          <button type="button" onClick={() => exportAudit('csv')}>Export CSV</button>
          <button type="button" onClick={() => exportAudit('json')}>Export JSON</button>
          <button type="button" onClick={clearAudit}>Clear</button>
        </div>
        {visibleAudit.length === 0 ? <p className="diagnostics-empty">No matching core events have been recorded.</p> : (
          <div className="audit-list">
            {visibleAudit.slice(0, 50).map(event => (
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
