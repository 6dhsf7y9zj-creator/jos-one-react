import type { InventoryItem, OrderRecord, StockStatus } from '../types/inventory'
import { advancePipeline } from '../lib/pipeline'
import { calculateOperations, type OperationsDestination, type OperationsTask } from '../lib/operations'
import { EmptyState, JosButton, KpiCard, SectionHeader } from '../ui'

type Props = {
  items: InventoryItem[]
  orders: OrderRecord[]
  onUpdate: (item: InventoryItem) => void
  onOpenInventory: (status?: StockStatus) => void
  onOpenPipeline: () => void
  onOpenOrders: () => void
  onOpenFinance: () => void
  onOpenSourceCheck: () => void
}

function routeTask(
  task: OperationsTask,
  callbacks: Record<OperationsDestination, () => void>,
  items: InventoryItem[],
  onUpdate: (item: InventoryItem) => void,
  onOpenInventory: (status?: StockStatus) => void,
): void {
  if (task.canAdvance && task.sku) {
    const item = items.find(value => value.sku === task.sku)
    if (item) {
      onUpdate(advancePipeline(item))
      return
    }
  }
  if (task.destination === 'inventory') {
    onOpenInventory(task.status)
    return
  }
  callbacks[task.destination]()
}

export function OperationsCommandCentre({
  items,
  orders,
  onUpdate,
  onOpenInventory,
  onOpenPipeline,
  onOpenOrders,
  onOpenFinance,
  onOpenSourceCheck,
}: Props) {
  const operations = calculateOperations(items, orders)
  const maxStage = Math.max(1, ...operations.stages.map(stage => stage.count))
  const highestProfitTasks = operations.tasks
    .filter(task => typeof task.expectedProfit === 'number')
    .sort((a, b) => (b.expectedProfit ?? 0) - (a.expectedProfit ?? 0))
    .slice(0, 4)

  const callbacks: Record<OperationsDestination, () => void> = {
    inventory: () => onOpenInventory(),
    pipeline: onOpenPipeline,
    orders: onOpenOrders,
    finance: onOpenFinance,
    sourcecheck: onOpenSourceCheck,
  }

  return (
    <main className="screen operations-command-centre">
      <section className="operations-hero">
        <div>
          <p className="eyebrow">OPERATIONS COMMAND CENTRE</p>
          <h2>Today&apos;s ranked workload</h2>
          <p>Customer commitments come first. Growth work is then ranked by workflow readiness and expected profit.</p>
        </div>
        <div className={`operations-score score-${operations.label.toLowerCase().replaceAll(' ', '-')}`}>
          <span>Operations health</span>
          <strong>{operations.score}</strong>
          <small>/100 · {operations.label}</small>
        </div>
      </section>

      <section className="jos-kpi-grid" aria-label="Operations position">
        <KpiCard
          label="Dispatch waiting"
          value={operations.ordersWaiting}
          tone={operations.ordersWaiting > 0 ? 'urgent' : 'positive'}
          onClick={onOpenOrders}
        />
        <KpiCard
          label="Pipeline waiting"
          value={operations.pipelineWaiting}
          tone={operations.pipelineWaiting > 0 ? 'warning' : 'positive'}
          onClick={onOpenPipeline}
        />
        <KpiCard
          label="Ready to upload"
          value={operations.readyToUpload}
          tone={operations.readyToUpload > 0 ? 'positive' : 'neutral'}
          onClick={onOpenPipeline}
        />
        <KpiCard
          label="Slow live stock"
          value={operations.slowStock}
          tone={operations.slowStock > 0 ? 'warning' : 'positive'}
          onClick={() => onOpenInventory('Live')}
        />
      </section>

      <section className="operations-mission-card">
        <div className="operations-mission-heading">
          <div>
            <p className="eyebrow light">TODAY&apos;S TWO-HOUR MISSION</p>
            <h2>{operations.tasks.length} ranked {operations.tasks.length === 1 ? 'task' : 'tasks'}</h2>
          </div>
          <div className="operations-time"><strong>{operations.totalMinutes}</strong><span>minutes</span></div>
        </div>

        {operations.tasks.length === 0 ? (
          <EmptyState
            title="No immediate operational backlog"
            description="Use SourceCheck before buying more stock, or review Finance before setting the next sourcing budget."
            action={
              <JosButton variant="secondary" onClick={onOpenSourceCheck}>
                Run SourceCheck
              </JosButton>
            }
          />
        ) : (
          <div className="operations-task-list">
            {operations.tasks.map((task, index) => (
              <article className={`operations-task task-${task.tone}`} key={task.id}>
                <span className="operations-task-number">{index + 1}</span>
                <div>
                  <strong>{task.title}</strong>
                  <small>{task.detail}</small>
                  {typeof task.expectedProfit === 'number' && <b>£{task.expectedProfit.toFixed(2)} expected profit</b>}
                </div>
                <span className="operations-task-time">{task.minutes}m</span>
                <button
                  type="button"
                  onClick={() => routeTask(task, callbacks, items, onUpdate, onOpenInventory)}
                >
                  {task.actionLabel}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel operations-bottleneck-panel">
        <SectionHeader
          eyebrow="BOTTLENECK DETECTOR"
          title={operations.bottleneck.label}
          compact
          action={<strong className="bottleneck-count">{operations.bottleneck.count}</strong>}
        />
        <p>{operations.bottleneck.count === 0 ? 'No active workflow bottleneck is visible.' : `${operations.bottleneck.count} items are waiting here. At the standard target, clearing this stage needs about ${operations.bottleneck.count * operations.bottleneck.targetMinutes} minutes.`}</p>
        <JosButton variant="secondary" onClick={onOpenPipeline}>Open pipeline</JosButton>
      </section>

      <section className="panel operations-timeline-panel">
        <SectionHeader eyebrow="OPERATIONS TIMELINE" title="Where stock is sitting" compact />
        <div className="operations-timeline">
          {operations.stages.map((stage, index) => (
            <button type="button" key={stage.label} onClick={onOpenPipeline}>
              <span className="timeline-index">{index + 1}</span>
              <span className="timeline-copy"><strong>{stage.label}</strong><small>{stage.count} items · {stage.targetMinutes ? `${stage.targetMinutes}m target each` : 'selling stage'}</small></span>
              <span className="timeline-bar"><span style={{ width: `${Math.max(5, (stage.count / maxStage) * 100)}%` }} /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel operations-profit-panel">
        <SectionHeader eyebrow="HIGHEST-PROFIT WORK" title="Money closest to being unlocked" compact />
        {highestProfitTasks.length === 0 ? <p className="operations-empty">No item-level profit tasks are currently available.</p> : (
          <div className="operations-profit-list">
            {highestProfitTasks.map(task => (
              <button type="button" key={task.id} onClick={() => routeTask(task, callbacks, items, onUpdate, onOpenInventory)}>
                <span><strong>{task.sku}</strong><small>{task.title.replace(`${task.sku} · `, '')}</small></span>
                <b>£{task.expectedProfit?.toFixed(2)}</b>
                <em>{task.actionLabel}</em>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="panel operations-quality-panel">
        <SectionHeader eyebrow="LISTING QUALITY" title="Missing evidence" compact />
        <div className="operations-quality-grid">
          <button type="button" onClick={onOpenPipeline}><span>Measurements missing</span><strong>{operations.missingMeasurements}</strong></button>
          <button type="button" onClick={() => onOpenInventory()}><span>Condition missing</span><strong>{operations.missingCondition}</strong></button>
        </div>
      </section>

      <section className="panel operations-week-panel">
        <SectionHeader eyebrow="LAST SEVEN DAYS" title="Recorded productivity" compact />
        <div className="operations-week-grid">
          <div><span>Sourced</span><strong>{operations.weekly.sourced}</strong></div>
          <div><span>Photographed</span><strong>{operations.weekly.photographed}</strong></div>
          <div><span>Ready</span><strong>{operations.weekly.ready}</strong></div>
          <div><span>Listed</span><strong>{operations.weekly.listed}</strong></div>
          <div><span>Sold</span><strong>{operations.weekly.sold}</strong></div>
        </div>
        <p className="operations-truth">Only recorded dates and timestamps are counted. Missing dates are not estimated.</p>
      </section>

      <section className="operations-quick-actions">
        <p className="eyebrow">QUICK ACTIONS</p><h2>Move directly into execution</h2>
        <div>
          <button type="button" onClick={onOpenOrders}>Dispatch orders</button>
          <button type="button" onClick={onOpenPipeline}>Photography & listings</button>
          <button type="button" onClick={() => onOpenInventory()}>Inventory command</button>
          <button type="button" onClick={onOpenFinance}>Finance command</button>
          <button type="button" onClick={onOpenSourceCheck}>Run SourceCheck</button>
        </div>
      </section>
    </main>
  )
}
