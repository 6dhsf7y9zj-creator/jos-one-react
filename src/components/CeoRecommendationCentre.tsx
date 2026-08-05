import { useMemo, useState } from 'react'
import type {
  InventoryItem,
  JosSettings,
  OrderRecord,
  StockStatus,
} from '../types/inventory.ts'
import {
  calculateCeoRecommendations,
  type CeoRecommendation,
  type CeoRecommendationConfidence,
  type CeoRecommendationUrgency,
} from '../lib/ceoRecommendations.ts'
import { formatFinanceMoney } from '../lib/finance.ts'
import { EmptyState, JosButton, KpiCard, NoticeCard, SectionHeader } from '../ui/index.ts'

type Props = {
  items: InventoryItem[]
  orders: OrderRecord[]
  settings: JosSettings
  onOpenInventory: (status?: StockStatus) => void
  onOpenOrders: () => void
  onOpenPipeline: () => void
  onOpenFinance: () => void
  onOpenBrandPerformance: () => void
  onOpenInventoryIntelligence: () => void
  onOpenSourceCheck: () => void
  onOpenOperations: () => void
}

type View = 'today' | 'all' | 'sourcing' | 'evidence'

function urgencyLabel(urgency: CeoRecommendationUrgency): string {
  return {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    opportunity: 'Opportunity',
  }[urgency]
}

function confidenceTone(
  confidence: CeoRecommendationConfidence,
): 'positive' | 'warning' | 'information' {
  if (confidence === 'high') return 'positive'
  if (confidence === 'medium') return 'warning'
  return 'information'
}

function recommendationAction(
  recommendation: CeoRecommendation,
  props: Props,
): () => void {
  switch (recommendation.destination) {
    case 'orders':
      return props.onOpenOrders
    case 'pipeline':
      return props.onOpenPipeline
    case 'finance':
      return props.onOpenFinance
    case 'brand-performance':
      return props.onOpenBrandPerformance
    case 'inventory-intelligence':
      return props.onOpenInventoryIntelligence
    case 'sourcecheck':
      return props.onOpenSourceCheck
    case 'operations':
      return props.onOpenOperations
    default:
      return () => props.onOpenInventory(recommendation.status)
  }
}

function impactText(recommendation: CeoRecommendation): string | undefined {
  if (recommendation.impact.protectedRevenue !== undefined) {
    return `${formatFinanceMoney(recommendation.impact.protectedRevenue)} protected revenue`
  }
  if (recommendation.impact.forecastProfit !== undefined) {
    return `${formatFinanceMoney(recommendation.impact.forecastProfit)} forecast profit`
  }
  if (recommendation.impact.cashUnderReview !== undefined) {
    return `${formatFinanceMoney(recommendation.impact.cashUnderReview)} cash under review`
  }
  if (recommendation.impact.safeSpendLimit !== undefined) {
    return `${formatFinanceMoney(recommendation.impact.safeSpendLimit)} maximum`
  }
  return undefined
}

function RecommendationCard({
  recommendation,
  index,
  props,
}: {
  recommendation: CeoRecommendation
  index: number
  props: Props
}) {
  const [expanded, setExpanded] = useState(false)
  const impact = impactText(recommendation)

  return (
    <article className={`cr-recommendation urgency-${recommendation.urgency}`}>
      <button
        type="button"
        className="cr-recommendation-main"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
      >
        <span className="cr-rank">{index + 1}</span>
        <span className="cr-copy">
          <strong>{recommendation.title}</strong>
          <small>{recommendation.detail}</small>
        </span>
        <span className="cr-time">{recommendation.minutes}m</span>
      </button>

      <div className="cr-recommendation-meta">
        <span>{urgencyLabel(recommendation.urgency)}</span>
        <span>{recommendation.confidence} confidence</span>
        {impact && <strong>{impact}</strong>}
      </div>

      {expanded && (
        <div className="cr-evidence-detail">
          <p><strong>Why:</strong> {recommendation.reason}</p>
          <p><strong>Confidence:</strong> {recommendation.confidenceReason}</p>
          <div>
            {recommendation.evidence.map(item => <span key={item}>{item}</span>)}
          </div>
        </div>
      )}

      <JosButton
        variant={recommendation.urgency === 'critical' ? 'primary' : 'secondary'}
        fullWidth
        onClick={recommendationAction(recommendation, props)}
      >
        {recommendation.actionLabel}
      </JosButton>
    </article>
  )
}

export function CeoRecommendationCentre(props: Props) {
  const report = useMemo(
    () => calculateCeoRecommendations(
      props.items,
      props.orders,
      props.settings,
    ),
    [props.items, props.orders, props.settings],
  )
  const [view, setView] = useState<View>('today')

  const views: Array<{ key: View; label: string }> = [
    { key: 'today', label: 'Today' },
    { key: 'all', label: 'All decisions' },
    { key: 'sourcing', label: 'Sourcing' },
    { key: 'evidence', label: 'Evidence' },
  ]

  const sourcingRecommendations = report.allRecommendations.filter(
    recommendation => recommendation.category === 'sourcing',
  )

  return (
    <main className="screen ceo-recommendation-centre">
      <section className="cr-hero">
        <div>
          <p className="eyebrow">CEO RECOMMENDATION ENGINE</p>
          <h2>Know what to do next—and why</h2>
          <p>
            JOS ranks customer, revenue, cash, finance and sourcing decisions from your
            current records. It recommends actions but never changes business data automatically.
          </p>
        </div>
        <div className={`cr-confidence confidence-${report.decisionConfidence}`}>
          <span>Decision confidence</span>
          <strong>{report.decisionConfidenceScore}</strong>
          <small>/100 · {report.decisionConfidence}</small>
        </div>
      </section>

      <NoticeCard
        title={report.sourcingHeadline}
        tone={
          report.sourcingDecision === 'selective'
            ? 'positive'
            : report.sourcingDecision === 'blocked'
              ? 'warning'
              : 'information'
        }
      >
        {report.sourcingReason}
      </NoticeCard>

      <section className="jos-kpi-grid cr-kpi-grid">
        <KpiCard
          label="Today's actions"
          value={report.todayPlan.length}
          detail={`${report.planMinutes} of ${report.dailyCapacityMinutes} planned minutes`}
          tone="information"
        />
        <KpiCard
          label="Protected revenue"
          value={formatFinanceMoney(report.protectedRevenue)}
          detail="Recorded customer commitments in today's plan"
          tone={report.protectedRevenue > 0 ? 'positive' : 'information'}
          onClick={props.onOpenOrders}
        />
        <KpiCard
          label="Forecast profit unlocked"
          value={formatFinanceMoney(report.forecastProfitUnlocked)}
          detail="Forecast only—not realised profit"
          tone="positive"
          onClick={props.onOpenPipeline}
        />
        <KpiCard
          label="Cash under review"
          value={formatFinanceMoney(report.cashUnderReview)}
          detail="Purchase cost—not guaranteed release"
          tone={report.cashUnderReview > 0 ? 'warning' : 'positive'}
          onClick={() => props.onOpenInventory('Live')}
        />
        <KpiCard
          label="Safe sourcing limit"
          value={formatFinanceMoney(report.safeSourcingLimit)}
          detail="Finance maximum—not a spending target"
          tone={report.safeSourcingLimit > 0 ? 'information' : 'warning'}
          onClick={props.onOpenFinance}
        />
        <KpiCard
          label="Operational backlog"
          value={report.operationalBacklog}
          detail={`${report.evidence.waitingOrders} commitments · ${report.evidence.pipelineWaiting} pipeline`}
          tone={report.operationalBacklog > 0 ? 'warning' : 'positive'}
          onClick={props.onOpenOperations}
        />
      </section>

      <section className="cr-tabs" aria-label="Recommendation views">
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

      {view === 'today' && (
        <section className="panel">
          <SectionHeader
            eyebrow="TODAY'S CONTROLLED PLAN"
            title="Highest-impact work within two hours"
            description="Critical customer work can exceed the normal time cap because it must not be deferred."
          />
          {report.todayPlan.length === 0 ? (
            <EmptyState
              title="No immediate action is supported"
              description="Current records do not show customer, pipeline, cash, finance or data work requiring attention."
            />
          ) : (
            <div className="cr-list">
              {report.todayPlan.map((recommendation, index) => (
                <RecommendationCard
                  key={recommendation.id}
                  recommendation={recommendation}
                  index={index}
                  props={props}
                />
              ))}
            </div>
          )}
          {report.deferred.length > 0 && (
            <p className="cr-truth">
              {report.deferred.length} lower-priority decisions remain outside today's time plan.
            </p>
          )}
        </section>
      )}

      {view === 'all' && (
        <section className="panel">
          <SectionHeader
            eyebrow="FULL DECISION QUEUE"
            title="Every current recommendation"
            description="The list remains ranked by customer risk, revenue proximity, cash exposure and evidence."
          />
          <div className="cr-list">
            {report.allRecommendations.map((recommendation, index) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                index={index}
                props={props}
              />
            ))}
          </div>
        </section>
      )}

      {view === 'sourcing' && (
        <>
          <section className={`cr-sourcing-decision decision-${report.sourcingDecision}`}>
            <p className="eyebrow light">SOURCING CONTROL</p>
            <h2>{report.sourcingHeadline}</h2>
            <p>{report.sourcingReason}</p>
            <div>
              <span>Recorded maximum</span>
              <strong>{formatFinanceMoney(report.safeSourcingLimit)}</strong>
            </div>
          </section>

          <section className="panel">
            <SectionHeader
              eyebrow="SOURCING ACTION"
              title="What the evidence currently supports"
              action={<JosButton variant="ghost" onClick={props.onOpenBrandPerformance}>Brand evidence</JosButton>}
            />
            {sourcingRecommendations.length === 0 ? (
              <EmptyState
                title="No sourcing action"
                description="Customer, stock and finance controls currently take priority."
              />
            ) : (
              <div className="cr-list">
                {sourcingRecommendations.map((recommendation, index) => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                    index={index}
                    props={props}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {view === 'evidence' && (
        <>
          <section className="panel">
            <SectionHeader
              eyebrow="DECISION EVIDENCE"
              title={`${report.decisionConfidenceScore}/100 overall confidence`}
              description={report.decisionConfidenceReason}
            />
            <div className="cr-evidence-grid">
              <div><span>Inventory data quality</span><strong>{report.evidence.inventoryDataQuality}/100</strong></div>
              <div><span>Inventory health</span><strong>{report.evidence.inventoryHealth}/100</strong></div>
              <div><span>Linked sales</span><strong>{report.evidence.linkedSales}</strong></div>
              <div><span>Unlinked sales</span><strong>{report.evidence.unlinkedSales}</strong></div>
              <div><span>Brands with sales evidence</span><strong>{report.evidence.brandsWithRealisedSales}</strong></div>
              <div><span>Finance transactions</span><strong>{report.evidence.financeTransactions}</strong></div>
            </div>
          </section>

          <section className="cr-rules">
            <p className="eyebrow">ENGINE RULES</p>
            {report.rules.map(rule => <p key={rule}>{rule}</p>)}
          </section>
        </>
      )}
    </main>
  )
}
