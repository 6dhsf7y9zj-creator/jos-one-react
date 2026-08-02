import type { InventoryItem, JosSettings, OrderRecord, StockStatus } from '../types/inventory'
import { calculateCeoDashboard, formatCeoMoney, type CeoMission } from '../lib/dashboard'
import { JosButton, KpiCard, SectionHeader } from '../ui'

type DashboardProps = {
  items: InventoryItem[]
  orders: OrderRecord[]
  settings: JosSettings
  onOpenInventory: (status?: StockStatus) => void
  onOpenOrders: () => void
  onOpenAdd: () => void
  onOpenSourceCheck: () => void
  onOpenFinance: () => void
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function missionAction(
  mission: CeoMission,
  callbacks: Pick<DashboardProps, 'onOpenInventory' | 'onOpenOrders' | 'onOpenAdd' | 'onOpenSourceCheck'>,
): () => void {
  if (mission.destination === 'orders') return callbacks.onOpenOrders
  if (mission.destination === 'add') return callbacks.onOpenAdd
  if (mission.destination === 'sourcecheck') return callbacks.onOpenSourceCheck
  return () => callbacks.onOpenInventory(mission.status)
}

export function Dashboard({
  items,
  orders,
  settings,
  onOpenInventory,
  onOpenOrders,
  onOpenAdd,
  onOpenSourceCheck,
  onOpenFinance,
}: DashboardProps) {
  const metrics = calculateCeoDashboard(items, orders)
  const firstMission = metrics.missions[0]
  const topBrands = metrics.brands.slice(0, 4)
  const workflow = [
    { label: 'Prep', count: metrics.prepItems, status: 'Prep' as StockStatus },
    { label: 'Photographed', count: metrics.photographedItems, status: 'Photographed' as StockStatus },
    { label: 'Live', count: metrics.liveItems, status: 'Live' as StockStatus },
    { label: 'Sold', count: metrics.soldItems, status: 'Sold' as StockStatus },
  ]
  const maxWorkflow = Math.max(1, ...workflow.map(stage => stage.count))

  return (
    <main className="screen ceo-dashboard">
      <section className="ceo-hero">
        <div className="ceo-hero-copy">
          <p className="eyebrow">CEO MISSION CONTROL</p>
          <h2>{greeting()}, Nick</h2>
          <p>
            JOS has ranked the work from your current inventory and orders.
            Complete customer commitments before growth tasks.
          </p>
          <div className="launch-countdown">
            <strong>{metrics.launchDays}</strong>
            <span>days to the January 2027 relaunch</span>
          </div>
        </div>

        <div className={`ceo-health health-${metrics.healthLabel.toLowerCase().replaceAll(' ', '-')}`}>
          <span>Business health</span>
          <strong>{metrics.businessHealth}</strong>
          <small>/100 · {metrics.healthLabel}</small>
        </div>
      </section>

      <section className="ceo-health-reasons" aria-label="Business health explanation">
        {metrics.healthReasons.map(reason => (
          <div className={`health-reason reason-${reason.tone}`} key={reason.label}>
            <span>{reason.label}</span>
            <strong>{reason.value}</strong>
          </div>
        ))}
      </section>

      <section className="ceo-mission-card">
        <div className="mission-card-heading">
          <div>
            <p className="eyebrow light">TODAY&apos;S TWO-HOUR PLAN</p>
            <h2>{metrics.missions.length} prioritised {metrics.missions.length === 1 ? 'action' : 'actions'}</h2>
          </div>
          <div className="mission-time">
            <strong>{metrics.missionMinutes}</strong>
            <span>mins</span>
          </div>
        </div>

        <div className="ceo-mission-list">
          {metrics.missions.map((mission, index) => (
            <button
              type="button"
              className={index === 0 ? 'primary-mission' : ''}
              key={mission.id}
              onClick={missionAction(mission, { onOpenInventory, onOpenOrders, onOpenAdd, onOpenSourceCheck })}
            >
              <span className="mission-number">{index + 1}</span>
              <span className="mission-copy">
                <strong>{mission.title}</strong>
                <small>{mission.detail}</small>
              </span>
              <span className="mission-minutes">{mission.minutes}m</span>
            </button>
          ))}
        </div>

        <div className="mission-outcome">
          <span>Expected operational impact</span>
          <strong>{metrics.missionImpact}</strong>
        </div>

        <button
          type="button"
          className="start-ceo-work"
          onClick={missionAction(firstMission, { onOpenInventory, onOpenOrders, onOpenAdd, onOpenSourceCheck })}
        >
          Start highest-priority work
        </button>
      </section>

      <section aria-labelledby="ceo-position">
        <SectionHeader
          eyebrow="FINANCIAL POSITION"
          title="What current records support"
          action={
            <JosButton variant="ghost" onClick={() => onOpenInventory()}>
              Open stock
            </JosButton>
          }
        />

        <div className="jos-kpi-grid">
          <KpiCard
            label="Cash tied in active stock"
            value={formatCeoMoney(metrics.inventoryCost)}
            detail={`${metrics.activeItems} active items`}
            onClick={() => onOpenInventory()}
          />
          <KpiCard
            label="Expected sales value"
            value={formatCeoMoney(metrics.expectedSales)}
            detail="Forecast, not guaranteed revenue"
            tone="information"
            onClick={() => onOpenInventory()}
          />
          <KpiCard
            label="Expected gross profit"
            value={formatCeoMoney(metrics.expectedProfit)}
            detail="Before tax and unrecorded costs"
            tone="positive"
            onClick={() => onOpenInventory()}
          />
          <KpiCard
            label="Realised profit recorded"
            value={formatCeoMoney(metrics.realisedProfit)}
            detail={`${formatCeoMoney(metrics.realisedRevenue)} sale revenue entered`}
            tone={metrics.realisedProfit >= 0 ? 'positive' : 'urgent'}
            onClick={onOpenFinance}
          />
        </div>

        <p className="ceo-data-truth">
          JOS cannot calculate “cash available to reinvest” until bank cash, sourcing budget
          and completed-sale receipts are recorded. It shows cash tied in stock instead.
        </p>
      </section>

      <section className="panel ceo-workflow-panel">
        <SectionHeader eyebrow="WORKFLOW FUNNEL" title="Where stock is waiting" compact />

        <div className="workflow-funnel">
          {workflow.map(stage => (
            <button type="button" key={stage.label} onClick={() => onOpenInventory(stage.status)}>
              <span className="workflow-label">{stage.label}</span>
              <span className="workflow-track">
                <span style={{ width: `${Math.max(6, (stage.count / maxWorkflow) * 100)}%` }} />
              </span>
              <strong>{stage.count}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="panel ceo-brands-panel">
        <SectionHeader eyebrow="BRAND FORECAST" title="Where expected profit currently sits" compact />

        {topBrands.length === 0 ? (
          <p className="ceo-empty">No active inventory is available for brand analysis.</p>
        ) : (
          <div className="brand-ranking">
            {topBrands.map((brand, index) => (
              <button type="button" key={brand.brand} onClick={() => onOpenInventory()}>
                <span className="brand-rank">{index + 1}</span>
                <span className="brand-name">
                  <strong>{brand.brand}</strong>
                  <small>{brand.itemCount} items · {brand.averageRoi.toFixed(0)}% average ROI</small>
                </span>
                <span className="brand-profit">{formatCeoMoney(brand.expectedProfit)}</span>
              </button>
            ))}
          </div>
        )}

        <p className="ceo-data-truth">
          This is a forecast from current stock, not proven brand performance. True performance
          needs completed sales and sale dates.
        </p>
      </section>

      <section className="panel ceo-alerts-panel">
        <SectionHeader eyebrow="CEO ALERTS" title="Decisions that need attention" compact />

        <button type="button" className="ceo-alert-row" onClick={onOpenOrders}>
          <span className={metrics.ordersWaiting > 0 || metrics.soldItems > 0 ? 'alert-dot urgent' : 'alert-dot good'} />
          <span>
            <strong>Dispatch commitments</strong>
            <small>{Math.max(metrics.ordersWaiting, metrics.soldItems)} waiting</small>
          </span>
          <b>›</b>
        </button>

        <button type="button" className="ceo-alert-row" onClick={() => onOpenInventory()}>
          <span className={metrics.missingStorage > 0 ? 'alert-dot warning' : 'alert-dot good'} />
          <span>
            <strong>Storage accuracy</strong>
            <small>{metrics.missingStorage} items missing a location</small>
          </span>
          <b>›</b>
        </button>

        <button type="button" className="ceo-alert-row" onClick={() => onOpenInventory('Live')}>
          <span className={metrics.ageingItems > 0 ? 'alert-dot warning' : 'alert-dot good'} />
          <span>
            <strong>Ageing live stock</strong>
            <small>{metrics.ageingItems} live items at 60+ days</small>
          </span>
          <b>›</b>
        </button>

        <button type="button" className="ceo-alert-row" onClick={() => onOpenInventory()}>
          <span className={metrics.exitItems > 0 ? 'alert-dot warning' : 'alert-dot good'} />
          <span>
            <strong>Exit stock</strong>
            <small>{metrics.exitItems} items marked to release cash</small>
          </span>
          <b>›</b>
        </button>
      </section>

      <section className="ceo-quick-actions">
        <p className="eyebrow">CEO SHORTCUTS</p>
        <h2>Move straight into execution</h2>
        <div>
          <button type="button" onClick={onOpenAdd}>Add stock</button>
          <button type="button" onClick={onOpenSourceCheck}>Run SourceCheck</button>
          <button type="button" onClick={onOpenOrders}>Open orders</button>
          <button type="button" onClick={onOpenFinance}>Finance command</button>
        </div>
        <p className="ceo-targets">
          Current sourcing rules: minimum {formatCeoMoney(settings.minimumProfit)} expected profit
          and {settings.targetRoi}% target ROI.
        </p>
      </section>
    </main>
  )
}
