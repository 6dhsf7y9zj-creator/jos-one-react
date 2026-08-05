import { useMemo } from 'react'
import type { FinanceState, InventoryItem, OrderRecord, StockStatus } from '../types/inventory.ts'
import { calculateRevenueIntelligence, stageToInventoryStatus } from '../lib/revenueIntelligence.ts'
import { formatFinanceMoney } from '../lib/finance.ts'
import { KpiCard, NoticeCard, SectionHeader } from '../ui/index.ts'

type Props = {
  items: InventoryItem[]
  orders: OrderRecord[]
  finance?: FinanceState
  onOpenInventory: (status?: StockStatus) => void
  onOpenPipeline: () => void
  onOpenOrders: () => void
  onOpenFinance: () => void
}

export function RevenueIntelligenceCentre({ items, orders, finance, onOpenInventory, onOpenPipeline, onOpenOrders, onOpenFinance }: Props) {
  const report = useMemo(() => calculateRevenueIntelligence(items, orders, finance), [items, orders, finance])
  const scoreTone = report.opportunityScore >= 75 ? 'positive' : report.opportunityScore >= 50 ? 'warning' : 'urgent'

  return (
    <main className="screen revenue-intelligence-centre">
      <section className="panel ri-hero">
        <SectionHeader
          eyebrow="REVENUE INTELLIGENCE ENGINE"
          title="Find the work that unlocks cash fastest"
          description="JOS ranks stock and customer commitments by expected financial impact, waiting time and readiness."
        />
        <div className={`ri-score ${scoreTone}`}>
          <span>Opportunity score</span>
          <strong>{report.opportunityScore}</strong>
          <small>/100 · {report.opportunityScore >= 75 ? 'Strong' : report.opportunityScore >= 50 ? 'Needs focus' : 'At risk'}</small>
        </div>
      </section>

      <section className="jos-kpi-grid ri-kpis">
        <KpiCard label="Expected revenue" value={formatFinanceMoney(report.expectedRevenue)} detail="Active stock opportunity" tone="information" />
        <KpiCard label="Expected profit" value={formatFinanceMoney(report.expectedProfit)} detail="Before tax and owner drawings" tone="positive" />
        <KpiCard label="Blocked revenue" value={formatFinanceMoney(report.blockedRevenue)} detail={`${formatFinanceMoney(report.blockedProfit)} profit before listing`} tone={report.blockedRevenue > 0 ? 'warning' : 'positive'} />
        <KpiCard label="Cash waiting" value={formatFinanceMoney(report.cashWaiting)} detail="Sold or dispatch-stage value" tone={report.cashWaiting > 0 ? 'urgent' : 'positive'} onClick={onOpenOrders} />
        <KpiCard label="Recorded revenue" value={formatFinanceMoney(report.realisedRevenue)} detail="Finance-ledger sales" tone="positive" onClick={onOpenFinance} />
      </section>

      {report.highestValueAction && (
        <section className="panel ri-priority">
          <p className="eyebrow">HIGHEST-VALUE ACTION</p>
          <h2>{report.highestValueAction.action}</h2>
          <p><strong>{report.highestValueAction.sku}</strong> · {report.highestValueAction.brand} · {report.highestValueAction.description}</p>
          <div className="ri-priority-impact">
            <span>{formatFinanceMoney(report.highestValueAction.expectedRevenue)} revenue</span>
            <span>{formatFinanceMoney(report.highestValueAction.expectedProfit)} profit</span>
            <span>Score {report.highestValueAction.score}/100</span>
          </div>
          <button type="button" className="primary-action" onClick={() => onOpenInventory(stageToInventoryStatus(report.highestValueAction!.stage))}>Open matching stock</button>
        </section>
      )}

      <section className="panel">
        <SectionHeader eyebrow="REVENUE FUNNEL" title="Where value is waiting" description="Tap a stage to move directly into the operational records behind it." />
        <div className="ri-stage-list">
          {report.stages.map(stage => (
            <button type="button" key={stage.stage} onClick={() => stage.stage === 'Dispatch' ? onOpenOrders() : stage.stage === 'Photography' || stage.stage === 'Listing work' || stage.stage === 'Ready to list' ? onOpenPipeline() : onOpenInventory(stageToInventoryStatus(stage.stage))}>
              <div><strong>{stage.stage}</strong><small>{stage.items} items · {stage.averageDays} avg days</small></div>
              <div><b>{formatFinanceMoney(stage.revenue)}</b><small>{formatFinanceMoney(stage.profit)} profit</small></div>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <SectionHeader eyebrow="RANKED OPPORTUNITIES" title="Complete these first" description="Ranking favours stronger profit, ROI, urgency and work closest to revenue." />
        <div className="ri-opportunity-list">
          {report.opportunities.filter(item => item.stage !== 'Completed').slice(0, 8).map((item, index) => (
            <article key={item.sku}>
              <span className="ri-rank">{index + 1}</span>
              <div><h3>{item.action}</h3><p>{item.sku} · {item.brand} · {item.description}</p><small>{item.stage} · {item.daysWaiting} days waiting</small></div>
              <div><strong>{formatFinanceMoney(item.expectedProfit)}</strong><small>Score {item.score}</small></div>
            </article>
          ))}
        </div>
      </section>

      {report.warnings.length > 0 && (
        <section className="ri-warning-list">
          {report.warnings.map(warning => <NoticeCard key={warning} title="Revenue blocker" tone="warning">{warning}</NoticeCard>)}
        </section>
      )}
    </main>
  )
}
