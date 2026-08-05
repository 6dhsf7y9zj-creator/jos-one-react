import { useMemo, useState } from 'react'
import type { FinanceState, InventoryItem, StockStatus } from '../types/inventory.ts'
import {
  calculateInventoryIntelligence,
  type InventoryHealthBand,
  type InventoryItemIntelligence,
} from '../lib/inventoryIntelligence.ts'
import { formatFinanceMoney } from '../lib/finance.ts'
import { JosButton, KpiCard, NoticeCard, SectionHeader } from '../ui/index.ts'

type Props = {
  items: InventoryItem[]
  finance?: FinanceState
  onUpdateMany: (items: InventoryItem[]) => void
  onOpenInventory: (status?: StockStatus) => void
  onOpenPipeline: () => void
  onOpenOrders: () => void
  onOpenFinance: () => void
}

type View = 'priorities' | 'grades' | 'ageing' | 'brands' | 'quality'

function actionDestination(entry: InventoryItemIntelligence, props: Props): () => void {
  if (entry.recommendedAction === 'Dispatch') return props.onOpenOrders
  if (['Upload', 'Write listing', 'Photograph', 'Prepare', 'Add measurements'].includes(entry.recommendedAction)) {
    return props.onOpenPipeline
  }
  return () => props.onOpenInventory(entry.item.status)
}

function bandLabel(band: InventoryHealthBand): string {
  return {
    healthy: 'Healthy',
    monitor: 'Monitor',
    attention: 'Needs attention',
    exit: 'Exit review',
  }[band]
}

export function InventoryIntelligenceEngine(props: Props) {
  const report = useMemo(
    () => calculateInventoryIntelligence(props.items, props.finance),
    [props.items, props.finance],
  )
  const [view, setView] = useState<View>('priorities')
  const [message, setMessage] = useState('')

  const changedGrades = report.items.filter(entry => entry.gradeChanged)

  const applyGrade = (entry: InventoryItemIntelligence) => {
    props.onUpdateMany([{ ...entry.item, grade: entry.recommendedGrade }])
    setMessage(`${entry.sku} changed from Grade ${entry.item.grade} to ${entry.recommendedGrade}.`)
  }

  const applyAllRecommendations = () => {
    if (!changedGrades.length) return
    if (!window.confirm(
      `Apply ${changedGrades.length} recommended grade change${changedGrades.length === 1 ? '' : 's'}? Automatic Backup will preserve the previous records.`,
    )) return
    props.onUpdateMany(
      changedGrades.map(entry => ({ ...entry.item, grade: entry.recommendedGrade })),
    )
    setMessage(`${changedGrades.length} grade recommendations applied.`)
  }

  const views: Array<{ key: View; label: string }> = [
    { key: 'priorities', label: 'Priorities' },
    { key: 'grades', label: 'Grades' },
    { key: 'ageing', label: 'Ageing' },
    { key: 'brands', label: 'Brands' },
    { key: 'quality', label: 'Data quality' },
  ]

  return (
    <main className="screen inventory-intelligence-centre">
      <section className="ii-hero">
        <div>
          <p className="eyebrow">INVENTORY INTELLIGENCE ENGINE</p>
          <h2>Turn stock records into controlled decisions</h2>
          <p>
            JOS scores stock health, cash exposure, listing readiness and evidence quality.
            Recommendations stay advisory until you choose to apply them.
          </p>
        </div>
        <div className={`ii-health health-${report.healthLabel.toLowerCase().replaceAll(' ', '-')}`}>
          <span>Inventory health</span>
          <strong>{report.healthScore}</strong>
          <small>/100 · {report.healthLabel}</small>
        </div>
      </section>

      {message && (
        <NoticeCard title={message} tone="positive" onDismiss={() => setMessage('')} />
      )}

      <section className="jos-kpi-grid">
        <KpiCard
          label="Cash tied in active stock"
          value={formatFinanceMoney(report.activeCost)}
          detail={`${report.activeItems} active items`}
          tone="information"
          onClick={() => props.onOpenInventory()}
        />
        <KpiCard
          label="Expected sales value"
          value={formatFinanceMoney(report.expectedSales)}
          detail="Forecast—not realised revenue"
          tone="information"
          onClick={() => props.onOpenInventory()}
        />
        <KpiCard
          label="Expected stock profit"
          value={formatFinanceMoney(report.expectedProfit)}
          detail={`${report.averageRoi.toFixed(0)}% average forecast ROI`}
          tone="positive"
          onClick={() => props.onOpenInventory()}
        />
        <KpiCard
          label="Grade changes suggested"
          value={changedGrades.length}
          detail="Nothing changes until approved"
          tone={changedGrades.length > 0 ? 'warning' : 'positive'}
          onClick={() => setView('grades')}
        />
      </section>

      <section className="ii-view-tabs" aria-label="Inventory intelligence views">
        {views.map(option => (
          <button
            type="button"
            className={view === option.key ? 'active' : ''}
            key={option.key}
            onClick={() => setView(option.key)}
          >
            {option.label}
          </button>
        ))}
      </section>

      {view === 'priorities' && (
        <>
          <section className="panel">
            <SectionHeader
              eyebrow="PRIORITY QUEUE"
              title="Highest-impact stock work"
              description="Customer commitments and items closest to becoming revenue are ranked first."
            />
            <div className="ii-priority-list">
              {report.priorities.map((entry, index) => (
                <button
                  type="button"
                  className={`ii-priority ii-band-${entry.healthBand}`}
                  key={entry.sku}
                  onClick={actionDestination(entry, props)}
                >
                  <span className="ii-rank">{index + 1}</span>
                  <span className="ii-priority-copy">
                    <strong>{entry.recommendedAction}: {entry.item.brand} {entry.item.category}</strong>
                    <small>{entry.sku} · {entry.actionReason}</small>
                  </span>
                  <span className="ii-priority-value">
                    {formatFinanceMoney(entry.forecastProfit)}
                    <small>{entry.priorityScore}/100</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <SectionHeader eyebrow="CASH LOCK REPORT" title="Where purchase cash is slowing down" compact />
            <div className="ii-cash-grid">
              {(['healthy', 'monitor', 'attention', 'exit'] as InventoryHealthBand[]).map(band => (
                <button type="button" key={band} onClick={() => setView('ageing')} className={`ii-cash-card band-${band}`}>
                  <span>{bandLabel(band)}</span>
                  <strong>{formatFinanceMoney(report.healthBands[band].cost)}</strong>
                  <small>{report.healthBands[band].items} items</small>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {view === 'grades' && (
        <section className="panel">
          <SectionHeader
            eyebrow="ADVISORY STOCK GRADING"
            title="Recommended A, B, C and Exit classifications"
            description="The engine considers forecast ROI, stock age, listing quality, readiness and linked brand evidence."
            action={
              changedGrades.length > 0
                ? <JosButton variant="primary" onClick={applyAllRecommendations}>Apply all</JosButton>
                : undefined
            }
          />
          <div className="ii-grade-summary">
            {(['A', 'B', 'C', 'Exit'] as InventoryItem['grade'][]).map(grade => (
              <div key={grade}><span>Recommended {grade}</span><strong>{report.grades[grade]}</strong></div>
            ))}
          </div>
          <div className="ii-grade-list">
            {report.items
              .filter(entry => entry.gradeChanged)
              .sort((a, b) => b.healthScore - a.healthScore)
              .map(entry => (
                <article key={entry.sku}>
                  <div>
                    <p className="eyebrow">{entry.sku}</p>
                    <strong>{entry.item.brand} {entry.item.category}</strong>
                    <small>
                      Current {entry.item.grade} → Recommended {entry.recommendedGrade} ·
                      Health {entry.healthScore}/100 · ROI {entry.forecastRoi.toFixed(0)}%
                    </small>
                  </div>
                  <JosButton variant="secondary" onClick={() => applyGrade(entry)}>Apply</JosButton>
                </article>
              ))}
            {changedGrades.length === 0 && (
              <p className="ii-truth">Saved stock grades already match the current recommendations.</p>
            )}
          </div>
        </section>
      )}

      {view === 'ageing' && (
        <>
          <section className="panel">
            <SectionHeader eyebrow="STOCK AGEING" title="How long active cash has been waiting" compact />
            <div className="ii-age-grid">
              <div className="age-healthy"><span>Under 30 days</span><strong>{report.ageing.under30}</strong><small>Healthy</small></div>
              <div className="age-monitor"><span>30–59 days</span><strong>{report.ageing.days30to59}</strong><small>Monitor</small></div>
              <div className="age-attention"><span>60–89 days</span><strong>{report.ageing.days60to89}</strong><small>Review</small></div>
              <div className="age-exit"><span>90+ days</span><strong>{report.ageing.days90plus}</strong><small>Cash release</small></div>
              <div><span>Age unknown</span><strong>{report.ageing.unknown}</strong><small>Date missing</small></div>
            </div>
            <p className="ii-truth">
              Age comes from days-in-stock or recorded sourced/listed dates. Missing dates are not estimated.
            </p>
          </section>

          <section className="panel">
            <SectionHeader eyebrow="AGEING ACTIONS" title="Stock requiring review" compact />
            <div className="ii-age-list">
              {report.items
                .filter(entry => entry.ageDays !== undefined && entry.ageDays >= 60)
                .sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0))
                .map(entry => (
                  <button type="button" key={entry.sku} onClick={() => props.onOpenInventory(entry.item.status)}>
                    <span><strong>{entry.item.brand} {entry.item.category}</strong><small>{entry.sku} · {entry.ageDays} days</small></span>
                    <span>{formatFinanceMoney(entry.cashLocked)} cost</span>
                  </button>
                ))}
            </div>
          </section>
        </>
      )}

      {view === 'brands' && (
        <section className="panel">
          <SectionHeader
            eyebrow="BRAND PERFORMANCE"
            title="Forecast separated from realised evidence"
            description="A brand is not called fast-selling unless linked sales and usable dates exist."
            action={<JosButton variant="ghost" onClick={props.onOpenFinance}>Finance records</JosButton>}
          />
          <div className="ii-brand-list">
            {report.brands.slice(0, 12).map((brand, index) => (
              <article key={brand.brand}>
                <span className="ii-rank">{index + 1}</span>
                <div>
                  <strong>{brand.brand}</strong>
                  <small>
                    {brand.activeItems} active · {formatFinanceMoney(brand.activeCost)} cost ·
                    {brand.averageForecastRoi.toFixed(0)}% forecast ROI
                  </small>
                  <small>
                    {brand.realisedSales > 0
                      ? `${brand.realisedSales} linked sales · ${formatFinanceMoney(brand.realisedProfit)} realised profit${brand.averageDaysToSell !== undefined ? ` · ${brand.averageDaysToSell.toFixed(0)} avg days` : ''}`
                      : 'No linked completed-sale evidence'}
                  </small>
                </div>
                <em>{brand.evidence}</em>
              </article>
            ))}
          </div>
        </section>
      )}

      {view === 'quality' && (
        <>
          <section className="panel">
            <SectionHeader eyebrow="DATA QUALITY" title={`${report.dataQuality.score}/100 decision confidence`} compact />
            <div className="ii-quality-grid">
              <div><span>Missing dates</span><strong>{report.dataQuality.missingDates}</strong></div>
              <div><span>Missing storage</span><strong>{report.dataQuality.missingStorage}</strong></div>
              <div><span>Missing measurements</span><strong>{report.dataQuality.missingMeasurements}</strong></div>
              <div><span>Sold without actual price</span><strong>{report.dataQuality.soldWithoutActualPrice}</strong></div>
              <div><span>Unlinked finance sales</span><strong>{report.dataQuality.unlinkedSales}</strong></div>
            </div>
          </section>

          <section className="panel">
            <SectionHeader eyebrow="SIMILAR RECORD WARNINGS" title="Potential duplicate stock" compact />
            {report.duplicateCandidates.length === 0 ? (
              <p className="ii-truth">No strong or possible similar-record warning was identified.</p>
            ) : (
              <div className="ii-duplicate-list">
                {report.duplicateCandidates.map(candidate => (
                  <button type="button" key={`${candidate.leftSku}-${candidate.rightSku}`} onClick={() => props.onOpenInventory()}>
                    <span><strong>{candidate.leftSku} ↔ {candidate.rightSku}</strong><small>{candidate.reason}</small></span>
                    <em>{candidate.confidence}</em>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <SectionHeader eyebrow="STORAGE INTELLIGENCE" title="Where active stock is recorded" compact />
            <div className="ii-storage-list">
              {report.storage.locations.slice(0, 10).map(location => (
                <div key={location.location}><span>{location.location}</span><strong>{location.items}</strong></div>
              ))}
            </div>
            {report.storage.missing > 0 && (
              <JosButton variant="secondary" fullWidth onClick={() => props.onOpenInventory()}>
                Assign {report.storage.missing} missing locations
              </JosButton>
            )}
          </section>
        </>
      )}

      <section className="ii-evidence">
        <p className="eyebrow">EVIDENCE RULES</p>
        {report.evidenceNotes.map(note => <p key={note}>{note}</p>)}
      </section>
    </main>
  )
}
