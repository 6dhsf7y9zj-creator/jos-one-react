import type {
  InventoryItem,
  JosSettings,
  OrderRecord,
  StockStatus,
} from '../types/inventory'
import { buildCeoReview, type ReviewPriority } from '../lib/ceoReview'
import { formatFinanceMoney } from '../lib/finance'

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

      <section className="review-kpis">
        <button type="button" onClick={props.onOpenFinance}>
          <span>Recorded business cash</span>
          <strong>{formatFinanceMoney(review.cashBalance)}</strong>
          <small>From Finance ledger</small>
        </button>
        <button type="button" onClick={props.onOpenFinance}>
          <span>Available sourcing budget</span>
          <strong>{formatFinanceMoney(review.availableSourcingBudget)}</strong>
          <small>After recorded reserves</small>
        </button>
        <button type="button" onClick={() => props.onOpenInventory()}>
          <span>Cash tied in stock</span>
          <strong>{formatFinanceMoney(review.inventoryCost)}</strong>
          <small>Active inventory cost</small>
        </button>
        <button type="button" onClick={() => props.onOpenInventory()}>
          <span>Forecast sales</span>
          <strong>{formatFinanceMoney(review.expectedSales)}</strong>
          <small>Not realised revenue</small>
        </button>
        <button type="button" onClick={() => props.onOpenInventory()}>
          <span>Forecast stock profit</span>
          <strong>{formatFinanceMoney(review.expectedProfit)}</strong>
          <small>Before tax and unknown costs</small>
        </button>
        <button type="button" onClick={props.onOpenFinance}>
          <span>Realised operating profit</span>
          <strong>{formatFinanceMoney(review.realisedProfit)}</strong>
          <small>From recorded ledger</small>
        </button>
      </section>

      <section className="review-recommendation">
        <p className="eyebrow light">TODAY&apos;S RECOMMENDATION</p>
        <h2>{review.recommendation.title}</h2>
        <p>{review.recommendation.explanation}</p>
        <button
          type="button"
          onClick={priorityAction({
            id: 'recommendation',
            title: review.recommendation.title,
            detail: review.recommendation.explanation,
            urgency: 'normal',
            destination: review.recommendation.destination,
          }, props)}
        >
          Open recommended module
        </button>
      </section>

      <section className="panel review-priorities">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">TODAY&apos;S PRIORITIES</p>
            <h2>Highest-impact work first</h2>
          </div>
        </div>

        {review.priorities.length === 0 ? (
          <p className="review-empty">No immediate operational priority is visible.</p>
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
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">HEALTH BREAKDOWN</p>
            <h2>Why the score looks this way</h2>
          </div>
        </div>
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
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">WORKFLOW POSITION</p>
            <h2>Where the business is waiting</h2>
          </div>
        </div>
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
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">WEEKLY RECORDED PERFORMANCE</p>
            <h2>Finance activity this week</h2>
          </div>
        </div>
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
          <button type="button" className="text-button" onClick={props.onOpenIntelligence}>Open intelligence</button>
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
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">CEO CHECKLIST</p>
            <h2>Daily control points</h2>
          </div>
        </div>
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
          <button type="button" className="text-button" onClick={props.onOpenBackup}>Open backup</button>
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
        </div>
      </section>

      <section className="review-data-truth">
        <p className="eyebrow">DATA TRUTH</p>
        {review.dataTruth.map(statement => <p key={statement}>{statement}</p>)}
      </section>
    </main>
  )
}
