import { useMemo } from 'react'
import type { InventoryItem, JosSettings, OrderRecord } from '../types/inventory.ts'
import { calculateReleaseReadiness } from '../core/ReleaseReadiness.ts'

export function ProductionReadinessCentre({
  items,
  orders,
  settings,
  onOpenDiagnostics,
  onOpenBackup,
  onOpenInventory,
  onOpenFinance,
}: {
  items: InventoryItem[]
  orders: OrderRecord[]
  settings: JosSettings
  onOpenDiagnostics: () => void
  onOpenBackup: () => void
  onOpenInventory: () => void
  onOpenFinance: () => void
}) {
  const report = useMemo(() => calculateReleaseReadiness(items, orders, settings), [items, orders, settings])

  const openAction = (id: string) => {
    if (id === 'backup') return onOpenBackup()
    if (id === 'finance') return onOpenFinance()
    if (id === 'storage' || id === 'sold-evidence') return onOpenInventory()
    return onOpenDiagnostics()
  }

  return (
    <main className="screen readiness-centre">
      <section className={`readiness-hero status-${report.status.toLowerCase()}`}>
        <div>
          <p className="eyebrow">PRODUCTION ACCEPTANCE</p>
          <h2>{report.status === 'Ready' ? 'JOS is ready for production use' : report.status === 'Conditional' ? 'JOS is ready with actions outstanding' : 'Production release is blocked'}</h2>
          <p>One controlled release gate now checks data integrity, recovery protection and operating readiness before the system is treated as production-safe.</p>
        </div>
        <div className="readiness-score">
          <strong>{report.score}</strong>
          <span>/100</span>
          <small>{report.status}</small>
        </div>
      </section>

      <section className="jos-kpi-grid readiness-summary">
        <article className="kpi-card"><span>Passed</span><strong>{report.passed}</strong><small>release gates</small></article>
        <article className="kpi-card"><span>Warnings</span><strong>{report.warnings}</strong><small>need attention</small></article>
        <article className="kpi-card"><span>Failed</span><strong>{report.failed}</strong><small>block release</small></article>
      </section>

      <section className="panel readiness-panel">
        <div className="section-header">
          <div><p className="eyebrow">RELEASE GATES</p><h2>Production checklist</h2></div>
        </div>
        <div className="readiness-gates">
          {report.gates.map(gate => (
            <article className={`readiness-gate gate-${gate.status}`} key={gate.id}>
              <span className="gate-indicator" aria-hidden="true">{gate.status === 'pass' ? '✓' : gate.status === 'warning' ? '!' : '×'}</span>
              <div>
                <h3>{gate.label}</h3>
                <p>{gate.detail}</p>
                {gate.action && <small>{gate.action}</small>}
              </div>
              {gate.status !== 'pass' && <button type="button" onClick={() => openAction(gate.id)}>Resolve</button>}
            </article>
          ))}
        </div>
      </section>

      <section className="panel readiness-actions">
        <p className="eyebrow">CONTROLLED RELEASE</p>
        <h2>Next release decision</h2>
        <p>{report.status === 'Ready' ? 'All gates have passed. Create an off-device backup, record the version and proceed with controlled live use.' : 'Resolve failed gates first. Warnings can be accepted only when the operational risk is understood.'}</p>
        <div className="button-row">
          <button type="button" className="primary-action" onClick={onOpenBackup}>Open Backup Centre</button>
          <button type="button" onClick={onOpenDiagnostics}>Open Core Diagnostics</button>
        </div>
      </section>
    </main>
  )
}
