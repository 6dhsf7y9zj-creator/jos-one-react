import { useMemo, useState } from 'react'
import type {
  AutomationSettings,
  InventoryItem,
  JosSettings,
  LaunchCommandSettings,
  OrderRecord,
} from '../types/inventory.ts'
import {
  calculateLaunchCommandReport,
  completeLaunchAutomationReview,
  markLaunchCommandReviewed,
  normaliseLaunchCommandSettings,
  toggleLaunchTask,
  updateLaunchTargets,
  type LaunchBlocker,
  type LaunchDestination,
  type LaunchTaskGroup,
  type LaunchTaskView,
} from '../lib/launchCommand.ts'
import { formatFinanceMoney } from '../lib/finance.ts'
import { JosButton, KpiCard, NoticeCard, SectionHeader } from '../ui/index.ts'

type Props = {
  items: InventoryItem[]
  orders: OrderRecord[]
  settings: JosSettings
  onChangeLaunchCommand: (launchCommand: LaunchCommandSettings) => void
  onChangeAutomation: (automation: AutomationSettings) => void
  onOpenInventory: () => void
  onOpenPipeline: () => void
  onOpenSourceCheck: () => void
  onOpenFinance: () => void
  onOpenAutomation: () => void
  onOpenBackup: () => void
}

type View = 'overview' | 'stock' | 'marketing' | 'operations' | 'launch-day'

function dateLabel(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function dateTime(value?: string): string {
  if (!value) return 'Never'
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function actionFor(
  destination: LaunchDestination,
  props: Props,
  openView: (view: View) => void,
): () => void {
  if (destination === 'inventory') return props.onOpenInventory
  if (destination === 'pipeline') return props.onOpenPipeline
  if (destination === 'sourcecheck') return props.onOpenSourceCheck
  if (destination === 'finance') return props.onOpenFinance
  if (destination === 'automation') return props.onOpenAutomation
  if (destination === 'backup') return props.onOpenBackup
  return () => openView('stock')
}

function blockerTone(
  blocker: LaunchBlocker,
): 'positive' | 'warning' | 'urgent' | 'information' {
  if (blocker.severity === 'critical') return 'urgent'
  if (blocker.severity === 'warning') return 'warning'
  if (blocker.severity === 'positive') return 'positive'
  return 'information'
}

function TaskList({
  tasks,
  group,
  onToggle,
}: {
  tasks: LaunchTaskView[]
  group: LaunchTaskGroup
  onToggle: (group: LaunchTaskGroup, id: string) => void
}) {
  return (
    <div className="lc-task-list">
      {tasks.map(task => (
        <label
          className={`lc-task status-${task.status}`}
          key={task.id}
        >
          <input
            type="checkbox"
            checked={task.completed}
            onChange={() => onToggle(group, task.id)}
          />
          <span>
            <strong>{task.title}</strong>
            <small>{task.description}</small>
            <em>
              Due {dateLabel(task.dueDate)} · {task.statusLabel}
              {task.completedAt ? ` · Completed ${dateTime(task.completedAt)}` : ''}
            </em>
          </span>
        </label>
      ))}
    </div>
  )
}

export function LaunchCommandCentre(props: Props) {
  const [view, setView] = useState<View>('overview')
  const [message, setMessage] = useState('')
  const launchCommand = useMemo(
    () => normaliseLaunchCommandSettings(props.settings.launchCommand),
    [props.settings.launchCommand],
  )
  const report = useMemo(
    () => calculateLaunchCommandReport(
      props.items,
      props.orders,
      {
        ...props.settings,
        launchCommand,
      },
    ),
    [props.items, props.orders, props.settings, launchCommand],
  )

  const updateLaunch = (next: LaunchCommandSettings) => {
    props.onChangeLaunchCommand(next)
  }

  const toggleTask = (group: LaunchTaskGroup, id: string) => {
    updateLaunch(toggleLaunchTask(launchCommand, group, id))
  }

  const completeReview = () => {
    const now = new Date()
    updateLaunch(markLaunchCommandReviewed(launchCommand, now))
    props.onChangeAutomation(
      completeLaunchAutomationReview(props.settings.automation, now),
    )
    setMessage('Launch review completed. The weekly Automation Centre routine has also been rescheduled.')
  }

  const views: Array<{ key: View; label: string }> = [
    { key: 'overview', label: 'Command view' },
    { key: 'stock', label: 'Stock & listings' },
    { key: 'marketing', label: 'Marketing' },
    { key: 'operations', label: 'Packaging' },
    { key: 'launch-day', label: 'Launch day' },
  ]

  return (
    <main className="screen launch-command-centre">
      <section className={`lc-hero phase-${report.phase}`}>
        <div>
          <p className="eyebrow light">JANUARY 2027 LAUNCH COMMAND CENTRE</p>
          <h2>
            {report.daysRemaining >= 0
              ? `${report.daysRemaining} days to launch`
              : `${Math.abs(report.daysRemaining)} days past the planned launch date`}
          </h2>
          <p>
            Planned launch: {dateLabel(report.launchDate)}. Stock, listings, marketing,
            packaging and foundation checks are measured separately so readiness cannot be
            overstated.
          </p>
        </div>
        <div className="lc-readiness-score">
          <span>Overall readiness</span>
          <strong>{report.overallReadiness}</strong>
          <small>/100 · {report.readinessLabel}</small>
        </div>
      </section>

      {message && (
        <NoticeCard title={message} tone="positive" onDismiss={() => setMessage('')} />
      )}

      {report.nextActions[0] && (
        <NoticeCard
          title={report.nextActions[0].title}
          tone={blockerTone(report.nextActions[0])}
        >
          <p>{report.nextActions[0].detail}</p>
          <JosButton
            variant="ghost"
            onClick={actionFor(report.nextActions[0].destination, props, setView)}
          >
            {report.nextActions[0].actionLabel}
          </JosButton>
        </NoticeCard>
      )}

      <section className="jos-kpi-grid lc-kpi-grid">
        <KpiCard
          label="Launch-eligible stock"
          value={`${report.stock.eligibleItems}/${report.stock.target}`}
          detail={`${report.stock.progress}% · ${report.stock.gap} item gap`}
          tone={report.stock.gap > 0 ? 'warning' : 'positive'}
          onClick={() => setView('stock')}
        />
        <KpiCard
          label="Listings ready"
          value={`${report.listings.readyItems}/${report.listings.target}`}
          detail={`${report.listings.progress}% · ${report.listings.gap} listing gap`}
          tone={report.listings.gap > 0 ? 'warning' : 'positive'}
          onClick={() => setView('stock')}
        />
        <KpiCard
          label="Priority-brand coverage"
          value={`${report.brands.coveredBrands}/${report.brands.priorityBrands}`}
          detail={`${report.brands.progress}% of approved brand direction`}
          tone={report.brands.progress >= 70 ? 'positive' : 'information'}
          onClick={() => setView('stock')}
        />
        <KpiCard
          label="Marketing readiness"
          value={`${report.marketing.progress}%`}
          detail={`${report.marketing.completed}/${report.marketing.total} complete · ${report.marketing.overdue} overdue`}
          tone={report.marketing.overdue > 0 ? 'warning' : report.marketing.progress === 100 ? 'positive' : 'information'}
          onClick={() => setView('marketing')}
        />
        <KpiCard
          label="Packaging readiness"
          value={`${report.packaging.progress}%`}
          detail={`${report.packaging.completed}/${report.packaging.total} checks complete`}
          tone={report.packaging.progress === 100 ? 'positive' : 'information'}
          onClick={() => setView('operations')}
        />
        <KpiCard
          label="Foundation checklist"
          value={`${report.coreChecklist.progress}%`}
          detail={`${report.coreChecklist.completed}/${report.coreChecklist.total} Automation Centre checks`}
          tone={report.coreChecklist.progress === 100 ? 'positive' : 'information'}
          onClick={props.onOpenAutomation}
        />
      </section>

      <section className="lc-tabs" aria-label="Launch Command Centre views">
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

      {view === 'overview' && (
        <>
          <section className="panel">
            <SectionHeader
              eyebrow="LAUNCH BLOCKERS"
              title="What can still stop a controlled launch"
              description="The list is ranked by timing, stock readiness, cash controls and operational risk."
              action={
                <JosButton variant="primary" onClick={completeReview}>
                  Complete weekly review
                </JosButton>
              }
            />
            {report.blockers.length === 0 ? (
              <NoticeCard title="No current launch blocker" tone="positive">
                All measured stock, listing, marketing, packaging and foundation targets are currently satisfied.
              </NoticeCard>
            ) : (
              <div className="lc-blocker-list">
                {report.blockers.map((blocker, index) => (
                  <article className={`severity-${blocker.severity}`} key={blocker.id}>
                    <span className="lc-rank">{index + 1}</span>
                    <div>
                      <strong>{blocker.title}</strong>
                      <small>{blocker.detail}</small>
                    </div>
                    <JosButton
                      variant={blocker.severity === 'critical' ? 'primary' : 'secondary'}
                      onClick={actionFor(blocker.destination, props, setView)}
                    >
                      {blocker.actionLabel}
                    </JosButton>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="lc-progress-grid">
            <button type="button" onClick={() => setView('stock')}>
              <span>Stock target</span>
              <strong>{report.stock.progress}%</strong>
              <i><b style={{ width: `${report.stock.progress}%` }} /></i>
            </button>
            <button type="button" onClick={() => setView('stock')}>
              <span>Listing readiness</span>
              <strong>{report.listings.progress}%</strong>
              <i><b style={{ width: `${report.listings.progress}%` }} /></i>
            </button>
            <button type="button" onClick={() => setView('marketing')}>
              <span>Marketing</span>
              <strong>{report.marketing.progress}%</strong>
              <i><b style={{ width: `${report.marketing.progress}%` }} /></i>
            </button>
            <button type="button" onClick={() => setView('operations')}>
              <span>Packaging</span>
              <strong>{report.packaging.progress}%</strong>
              <i><b style={{ width: `${report.packaging.progress}%` }} /></i>
            </button>
          </section>

          <section className="lc-review-evidence">
            <div>
              <span>Last command review</span>
              <strong>{dateTime(report.evidence.commandReviewLastCompletedAt)}</strong>
            </div>
            <div>
              <span>Automation launch review</span>
              <strong>{dateTime(report.evidence.launchReviewLastCompletedAt)}</strong>
            </div>
            <div>
              <span>Forecast confidence</span>
              <strong>{report.evidence.forecastConfidence}/100</strong>
            </div>
          </section>
        </>
      )}

      {view === 'stock' && (
        <>
          <section className="panel">
            <SectionHeader
              eyebrow="OPENING COLLECTION TARGETS"
              title="Define what launch-ready means"
              description="The defaults are planning values and remain editable."
            />
            <div className="lc-target-controls">
              <label>
                Opening launch-stock target
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={launchCommand.openingStockTarget}
                  onChange={event => updateLaunch(
                    updateLaunchTargets(
                      launchCommand,
                      Number(event.target.value) || 0,
                      launchCommand.readyListingTarget,
                    ),
                  )}
                />
              </label>
              <label>
                Ready-listing target
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={launchCommand.readyListingTarget}
                  onChange={event => updateLaunch(
                    updateLaunchTargets(
                      launchCommand,
                      launchCommand.openingStockTarget,
                      Number(event.target.value) || 0,
                    ),
                  )}
                />
              </label>
            </div>
          </section>

          <section className="panel">
            <SectionHeader
              eyebrow="STOCK READINESS"
              title="Owned stock versus usable launch stock"
              action={<JosButton variant="ghost" onClick={props.onOpenInventory}>Open Inventory</JosButton>}
            />
            <div className="lc-stock-grid">
              <div><span>All active stock</span><strong>{report.stock.allActiveItems}</strong></div>
              <div><span>Launch-eligible</span><strong>{report.stock.eligibleItems}</strong></div>
              <div><span>Exit stock excluded</span><strong>{report.stock.exitItems}</strong></div>
              <div><span>Missing storage</span><strong>{report.storageMissing}</strong></div>
              <div><span>Average buy cost</span><strong>{formatFinanceMoney(report.stock.averagePurchaseCost)}</strong></div>
              <div><span>Estimated gap cost</span><strong>{formatFinanceMoney(report.stock.estimatedGapCost)}</strong></div>
              <div><span>Current safe sourcing</span><strong>{formatFinanceMoney(report.stock.currentSafeSourcingCash)}</strong></div>
              <div><span>Forecast safe sourcing</span><strong>{formatFinanceMoney(report.stock.forecastSafeSourcingCash)}</strong></div>
            </div>
            <div className="lc-stock-actions">
              <JosButton variant="secondary" onClick={props.onOpenSourceCheck}>Open SourceCheck</JosButton>
              <JosButton variant="secondary" onClick={props.onOpenFinance}>Review Finance</JosButton>
            </div>
          </section>

          <section className="panel">
            <SectionHeader
              eyebrow="LISTING PIPELINE"
              title="How close the collection is to upload"
              action={<JosButton variant="ghost" onClick={props.onOpenPipeline}>Open Pipeline</JosButton>}
            />
            <div className="lc-pipeline-grid">
              <div><span>Preparation</span><strong>{report.listings.preparationItems}</strong></div>
              <div><span>Photography</span><strong>{report.listings.photographyItems}</strong></div>
              <div><span>Photo complete</span><strong>{report.listings.photoCompleteItems}</strong></div>
              <div><span>Listing copy</span><strong>{report.listings.listingCopyItems}</strong></div>
              <div><span>Ready to upload/live</span><strong>{report.listings.readyItems}</strong></div>
              <div><span>Average readiness</span><strong>{report.listings.averageReadiness.toFixed(0)}%</strong></div>
            </div>
          </section>

          <section className="panel">
            <SectionHeader
              eyebrow="PRIORITY BRAND COVERAGE"
              title="Representation across the approved brand direction"
              description="Coverage is a launch assortment check, not proof of demand."
            />
            <div className="lc-brand-grid">
              {report.brands.coverage.map(brand => (
                <article className={brand.covered ? 'covered' : ''} key={brand.brand}>
                  <strong>{brand.brand}</strong>
                  <span>{brand.activeItems} active · {brand.readyItems} ready</span>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <SectionHeader eyebrow="STOCK GRADES" title="Current active-stock mix" compact />
            <div className="lc-grade-grid">
              <div><span>A Stock</span><strong>{report.grades.A}</strong></div>
              <div><span>B Stock</span><strong>{report.grades.B}</strong></div>
              <div><span>C Stock</span><strong>{report.grades.C}</strong></div>
              <div><span>Exit Stock</span><strong>{report.grades.Exit}</strong></div>
            </div>
          </section>
        </>
      )}

      {view === 'marketing' && (
        <section className="panel">
          <SectionHeader
            eyebrow="LAUNCH MARKETING SCHEDULE"
            title={`${report.marketing.completed} of ${report.marketing.total} campaign milestones complete`}
            description="The schedule follows the approved The JAE Edit launch themes and counts backwards from the saved launch date."
          />
          <TaskList
            tasks={report.marketing.tasks}
            group="marketing"
            onToggle={toggleTask}
          />
        </section>
      )}

      {view === 'operations' && (
        <>
          <section className="panel">
            <SectionHeader
              eyebrow="PACKAGING AND DISPATCH READINESS"
              title={`${report.packaging.completed} of ${report.packaging.total} controls complete`}
              description="Each check requires manual confirmation after the physical process has been tested."
            />
            <TaskList
              tasks={report.packaging.tasks}
              group="packaging"
              onToggle={toggleTask}
            />
          </section>

          <section className="lc-foundation-link">
            <div>
              <p className="eyebrow light">FOUNDATION READINESS</p>
              <h2>{report.coreChecklist.progress}% complete</h2>
              <p>
                The Automation Centre holds the broader sole-trader, banking, stock,
                marketing and backup checklist.
              </p>
            </div>
            <JosButton variant="secondary" fullWidth onClick={props.onOpenAutomation}>
              Open Automation Centre
            </JosButton>
          </section>
        </>
      )}

      {view === 'launch-day' && (
        <>
          <section className={`lc-launch-day-summary phase-${report.phase}`}>
            <div>
              <p className="eyebrow light">LAUNCH-DAY CONTROL</p>
              <h2>{report.launchDay.completed}/{report.launchDay.total} controls complete</h2>
              <p>
                These controls protect the launch itself. Completing them early records
                preparation; JOS will not upload listings or publish posts automatically.
              </p>
            </div>
            <strong>{report.launchDay.progress}%</strong>
          </section>

          <section className="panel">
            <SectionHeader
              eyebrow="LAUNCH-DAY CHECKLIST"
              title="Backup, finance, listings, marketing and orders"
              action={<JosButton variant="ghost" onClick={props.onOpenBackup}>Backup Centre</JosButton>}
            />
            <TaskList
              tasks={report.launchDay.tasks}
              group="launch-day"
              onToggle={toggleTask}
            />
          </section>
        </>
      )}

      <section className="lc-assumptions">
        <p className="eyebrow">COMMAND-CENTRE RULES</p>
        {report.assumptions.map(assumption => <p key={assumption}>{assumption}</p>)}
      </section>
    </main>
  )
}
