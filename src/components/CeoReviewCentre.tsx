import type {
  InventoryItem,
  JosSettings,
  OrderRecord,
  StockStatus,
} from '../types/inventory'
import { buildCeoReview, type ReviewPriority } from '../lib/ceoReview'
import { formatFinanceMoney } from '../lib/finance'
import { EmptyState, JosButton, KpiCard, SectionHeader } from '../ui'
import { calculateCeoRecommendations } from '../lib/ceoRecommendations'

type Props = {
  items: InventoryItem[]
  orders: OrderRecord[]
  settings: JosSettings
  onOpenInventory: (status?: StockStatus) => void
  onOpenOrders: () => void
  onOpenPipeline: () => void
  onOpenFinance: () => void
  onOpenIntelligence: () => void
  onOpenBackup: () => void
  onOpenAdd: () => void
  onOpenSourceCheck: () => void
  onOpenRecommendations: () => void
}

function priorityAction(priority: ReviewPriority, props: Props): () => void {
  switch (priority.destination) {
    case 'orders':
      return props.onOpenOrders
    case 'pipeline':
      return props.onOpenPipeline
    case 'finance':
      return props.onOpenFinance
    case 'intelligence':
      return props.onOpenIntelligence
    case 'backup':
      return props.onOpenBackup
    default:
      return () => props.onOpenInventory(priority.status)
  }
}

function ageText(hours?: number): string {
  if (hours === undefined) return 'No backup'
  if (hours < 1) return 'Less than 1 hour ago'
  if (hours < 24) return `${Math.floor(hours)} hours ago`
  return `${Math.floor(hours / 24)} days ago`
}

export function CeoReviewCentre(props: Props) {
  const review = buildCeoReview(props.items, props.orders, props.settings)
  const recommendations = calculateCeoRecommendations(props.items, props.orders, props.settings)
  const topDecision = recommendations.todayPlan[0]

  return (
    <main className="screen ceo-review-centre">
      <section className="review-hero">
        <div>
          <p className="eyebrow">CEO REVIEW CENTRE</p>
          <h2>Your business in one briefing</h2>
          <p>
            Recorded facts, operational priorities and forecasts—kept separate so decisions
            are based on evidence rather than optimistic assumptions.
          </p>
        </div>
        <div className={`review-health health-${review.healthLabel.toLowerCase().replaceAll(' ', '-')}`}>
          <span>Business health</span>
          <strong>{review.businessHealth}</strong>
          <small>/100 · {review.healthLabel}</small>
        </div>
      </section>

      <section className="jos-kpi-grid review-kpi-grid" aria-label="CEO review summary">
        <KpiCard
          label="Recorded business cash"
          value={formatFinanceMoney(review.cashBalance)}
          detail="From Finance ledger"
          tone={review.cashBalance >= 0 ? 'positive' : 'urgent'}
          onClick={props.onOpenFinance}
        />
        <KpiCard
          label="Available sourcing budget"
          value={formatFinanceMoney(review.availableSourcingBudget)}
          detail="After recorded reserves"
          tone={review.availableSourcingBudget > 0 ? 'positive' : 'warning'}
          onClick={props.onOpenFinance}
        />
        <KpiCard
          label="Cash tied in stock"
          value={formatFinanceMoney(review.inventoryCost)}
          detail="Active inventory cost"
          tone="information"
          onClick={() => props.onOpenInventory()}
        />
        <KpiCard
          label="Forecast sales"
          value={formatFinanceMoney(review.expectedSales)}
          detail="Not realised revenue"
          tone="information"
          onClick={() => props.onOpenInventory()}
        />
        <KpiCard
          label="Forecast stock profit"
          value={formatFinanceMoney(review.expectedProfit)}
          detail="Before tax and unknown costs"
          tone="positive"
          onClick={() => props.onOpenInventory()}
        />
        <KpiCard
          label="Realised operating profit"
          value={formatFinanceMoney(review.realisedProfit)}
          detail="From recorded ledger"
          tone={review.realisedProfit >= 0 ? 'positive' : 'urgent'}
          onClick={props.onOpenFinance}
        />
      </section>

      <section className="review-recommendation">
        <p className="eyebrow light">CEO RECOMMENDATION ENGINE</p>
        <h2>{topDecision?.title ?? review.recommendation.title}</h2>
        <p>{topDecision?.detail ?? review.recommendation.explanation}</p>
        <small>
          {recommendations.todayPlan.length} ranked actions · {recommendations.planMinutes} planned minutes ·
          {` ${recommendations.decisionConfidenceScore}/100 confidence`}
        </small>
        <JosButton
          variant="primary"
          fullWidth
          onClick={props.onOpenRecommendations}
        >
          Open full decision plan
        </JosButton>
      </section>

      <section className="panel review-priorities">
        <SectionHeader eyebrow="TODAY'S PRIORITIES" title="Highest-impact work first" compact />

        {review.priorities.length === 0 ? (
          <EmptyState
            title="No immediate operational priority"
            description="Current records do not show urgent dispatch, pipeline or stock work."
          />
        ) : (
          <div className="review-priority-list">
            {review.priorities.map((priority, index) => (
              <button
                type="button"
                className={`review-priority priority-${priority.urgency}`}
                key={priority.id}
                onClick={priorityAction(priority, props)}
              >
                <span className="review-priority-number">{index + 1}</span>
                <span className="review-priority-copy">
                  <strong>{priority.title}</strong>
                  <small>{priority.detail}</small>
                </span>
                <span className="review-priority-value">{priority.value ?? 'Open'}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="panel review-health-panel">
        <SectionHeader eyebrow="HEALTH BREAKDOWN" title="Why the score looks this way" compact />
        <div className="review-health-grid">
          {review.healthBreakdown.map(section => (
            <div key={section.label}>
              <span>{section.label}</span>
              <strong>{section.score}</strong>
              <progress max="100" value={section.score} />
              <small>{section.detail}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="panel review-workflow">
        <SectionHeader eyebrow="WORKFLOW POSITION" title="Where the business is waiting" compact />
        <div className="review-workflow-grid">
          <button type="button" onClick={props.onOpenPipeline}><span>Preparation</span><strong>{review.workflow.prep}</strong></button>
          <button type="button" onClick={props.onOpenPipeline}><span>Photography</span><strong>{review.workflow.photography}</strong></button>
          <button type="button" onClick={props.onOpenPipeline}><span>Listing copy</span><strong>{review.workflow.listing}</strong></button>
          <button type="button" onClick={props.onOpenPipeline}><span>Ready to upload</span><strong>{review.workflow.ready}</strong></button>
          <button type="button" onClick={() => props.onOpenInventory('Live')}><span>Live</span><strong>{review.workflow.live}</strong></button>
          <button type="button" onClick={props.onOpenOrders}><span>Dispatch waiting</span><strong>{review.workflow.dispatchWaiting}</strong></button>
        </div>
      </section>

      <section className="panel review-performance">
        <SectionHeader eyebrow="WEEKLY RECORDED PERFORMANCE" title="Finance activity this week" compact />
        <div className="review-week-grid">
          <div><span>Sales recorded</span><strong>{formatFinanceMoney(review.weeklySales)}</strong></div>
          <div><span>Expenses recorded</span><strong>{formatFinanceMoney(review.weeklyExpenses)}</strong></div>
          <div><span>Net cash movement</span><strong>{formatFinanceMoney(review.weeklySales - review.weeklyExpenses)}</strong></div>
        </div>
      </section>

      <section className="panel review-brands">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">BRAND EVIDENCE</p>
            <h2>Forecast and realised results</h2>
          </div>
          <JosButton variant="ghost" onClick={props.onOpenIntelligence}>Open intelligence</JosButton>
        </div>

        <div className="review-brand-grid">
          <div>
            <span>Top forecast brand</span>
            <strong>{review.topForecastBrand?.brand ?? 'Not enough stock data'}</strong>
            <small>
              {review.topForecastBrand
                ? `${formatFinanceMoney(review.topForecastBrand.expectedProfit)} forecast profit · ${review.topForecastBrand.averageRoi.toFixed(0)}% ROI`
                : 'No active brand forecast available.'}
            </small>
          </div>
          <div>
            <span>Top realised brand</span>
            <strong>{review.realisedBrand?.brand ?? 'Not enough completed sales'}</strong>
            <small>
              {review.realisedBrand
                ? `${formatFinanceMoney(review.realisedBrand.realisedProfit)} realised profit · ${review.realisedBrand.realisedSales} linked sales · ${review.realisedBrand.confidence}`
                : 'Record and link completed sales before treating brand performance as proven.'}
            </small>
          </div>
        </div>
      </section>

      <section className="panel review-checklist">
        <SectionHeader eyebrow="CEO CHECKLIST" title="Daily control points" compact />
        <div className="review-checklist-list">
          {review.checklist.map(item => (
            <div className={item.complete ? 'complete' : ''} key={item.id}>
              <span className="review-checkmark">{item.complete ? '✓' : '○'}</span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel review-backup">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">DATA PROTECTION</p>
            <h2>Backup position</h2>
          </div>
          <JosButton variant="ghost" onClick={props.onOpenBackup}>Open backup</JosButton>
        </div>
        <div className="review-backup-grid">
          <div><span>Latest snapshot</span><strong>{ageText(review.backup.ageHours)}</strong></div>
          <div><span>Snapshots retained</span><strong>{review.backup.snapshots}</strong></div>
          <div><span>Items protected</span><strong>{review.backup.protectedItems}</strong></div>
        </div>
      </section>

      <section className="review-quick-actions">
        <p className="eyebrow">EXECUTIVE SHORTCUTS</p>
        <h2>Move from review to action</h2>
        <div>
          <button type="button" onClick={props.onOpenAdd}>Add stock</button>
          <button type="button" onClick={props.onOpenPipeline}>Pipeline</button>
          <button type="button" onClick={props.onOpenOrders}>Orders</button>
          <button type="button" onClick={props.onOpenFinance}>Finance</button>
          <button type="button" onClick={props.onOpenIntelligence}>Intelligence</button>
          <button type="button" onClick={props.onOpenSourceCheck}>SourceCheck</button>
          <button type="button" onClick={props.onOpenRecommendations}>Decision engine</button>
        </div>
      </section>

      <section className="review-data-truth">
        <p className="eyebrow">DATA TRUTH</p>
        {review.dataTruth.map(statement => <p key={statement}>{statement}</p>)}
      </section>
    </main>
  )
}
