import { useMemo, useState } from 'react'
import type {
  InventoryItem,
  JosSettings,
  OrderRecord,
} from '../types/inventory'
import {
  calculateBusinessForecast,
  type ForecastScenario,
} from '../lib/businessForecasting'
import { formatFinanceMoney } from '../lib/finance'
import { JosButton, KpiCard, NoticeCard, SectionHeader } from '../ui'

type Props = {
  items: InventoryItem[]
  orders: OrderRecord[]
  settings: JosSettings
  onChangeTarget: (target: number) => void
  onOpenFinance: () => void
  onOpenInventory: () => void
  onOpenPipeline: () => void
  onOpenRecommendations: () => void
}

type View = 'cash' | 'profit' | 'scenarios' | 'evidence'

function dateLabel(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

function scenarioLabel(scenario: ForecastScenario): string {
  return {
    conservative: 'Conservative',
    base: 'Base',
    optimistic: 'Optimistic',
  }[scenario]
}

export function BusinessForecastingCentre(props: Props) {
  const [scenario, setScenario] = useState<ForecastScenario>('base')
  const [view, setView] = useState<View>('cash')
  const monthlyTarget = Math.max(0, props.settings.monthlyProfitTarget ?? 5000)
  const report = useMemo(
    () => calculateBusinessForecast(
      props.items,
      props.orders,
      props.settings,
      {
        scenario,
        horizonWeeks: 12,
        monthlyProfitTarget: monthlyTarget,
      },
    ),
    [props.items, props.orders, props.settings, scenario, monthlyTarget],
  )

  const maximumSales = Math.max(
    1,
    ...report.weeks.map(week => week.projectedSales),
  )
  const maximumProfit = Math.max(
    1,
    ...report.weeks.map(week => Math.abs(week.projectedOperatingProfit)),
  )
  const views: Array<{ key: View; label: string }> = [
    { key: 'cash', label: 'Cash forecast' },
    { key: 'profit', label: 'Profit target' },
    { key: 'scenarios', label: 'Scenarios' },
    { key: 'evidence', label: 'Evidence' },
  ]

  return (
    <main className="screen business-forecasting-centre">
      <section className="bf-hero">
        <div>
          <p className="eyebrow">BUSINESS FORECASTING ENGINE</p>
          <h2>See the range before spending the cash</h2>
          <p>
            JOS projects sales, operating profit, tax-reserve needs and cash capacity
            across twelve weeks. Every result remains a planning scenario, not a promise.
          </p>
        </div>
        <div className={`bf-confidence confidence-${report.confidence}`}>
          <span>Forecast confidence</span>
          <strong>{report.confidenceScore}</strong>
          <small>/100 · {report.confidence}</small>
        </div>
      </section>

      <NoticeCard
        title={`${scenarioLabel(scenario)} scenario`}
        tone={
          report.confidence === 'high'
            ? 'positive'
            : report.confidence === 'medium'
              ? 'warning'
              : 'information'
        }
      >
        {report.confidenceReason}
      </NoticeCard>

      <section className="bf-scenario-switch" aria-label="Forecast scenario">
        {(['conservative', 'base', 'optimistic'] as ForecastScenario[]).map(option => (
          <button
            type="button"
            className={scenario === option ? 'active' : ''}
            key={option}
            onClick={() => setScenario(option)}
          >
            <strong>{scenarioLabel(option)}</strong>
            <small>
              {formatFinanceMoney(
                report.scenarioComparison[option].projectedOperatingProfit,
              )} profit
            </small>
          </button>
        ))}
      </section>

      <section className="jos-kpi-grid bf-kpi-grid">
        <KpiCard
          label="Projected 12-week sales"
          value={formatFinanceMoney(report.summary.projectedSales)}
          detail={`${report.summary.projectedItemsSold.toFixed(1)} expected item sales`}
          tone="information"
        />
        <KpiCard
          label="Projected operating profit"
          value={formatFinanceMoney(report.summary.projectedOperatingProfit)}
          detail="After forecast cost of goods and ledger expense run rate"
          tone={report.summary.projectedOperatingProfit >= 0 ? 'positive' : 'urgent'}
        />
        <KpiCard
          label="Projected closing cash"
          value={formatFinanceMoney(report.summary.projectedEndCash)}
          detail={`Lowest point ${formatFinanceMoney(report.summary.lowestCashPoint)}`}
          tone={report.summary.lowestCashPoint >= 0 ? 'positive' : 'urgent'}
          onClick={props.onOpenFinance}
        />
        <KpiCard
          label="Rolling 30-day profit"
          value={formatFinanceMoney(report.summary.rolling30DayProfit)}
          detail={`${report.summary.targetProgress}% of ${formatFinanceMoney(monthlyTarget)} target`}
          tone={report.summary.targetProgress >= 100 ? 'positive' : 'warning'}
        />
        <KpiCard
          label="Monthly target gap"
          value={formatFinanceMoney(report.summary.monthlyTargetGap)}
          detail={report.summary.monthlyTargetGap > 0 ? 'Planning gap—not guaranteed required sales' : 'Target met in this scenario'}
          tone={report.summary.monthlyTargetGap > 0 ? 'warning' : 'positive'}
        />
        <KpiCard
          label="Safe sourcing capacity"
          value={formatFinanceMoney(report.summary.safeSourcingCapacity)}
          detail="Maximum after reserve controls—not a spending target"
          tone={report.summary.safeSourcingCapacity > 0 ? 'information' : 'warning'}
          onClick={props.onOpenFinance}
        />
      </section>

      <section className="bf-controls panel">
        <label>
          Monthly operating-profit target
          <span>
            £
            <input
              type="number"
              min="0"
              step="100"
              inputMode="decimal"
              value={monthlyTarget}
              onChange={event => props.onChangeTarget(
                Math.max(0, Number(event.target.value) || 0),
              )}
            />
          </span>
        </label>
        <div className="bf-view-tabs">
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
        </div>
      </section>

      {view === 'cash' && (
        <>
          <section className="panel">
            <SectionHeader
              eyebrow="12-WEEK CASH OUTLOOK"
              title="Projected weekly cash movement"
              description="Cost of goods reduces operating profit but is not subtracted from cash again because the forecast starts from your recorded cash balance."
              action={<JosButton variant="ghost" onClick={props.onOpenFinance}>Open Finance</JosButton>}
            />
            <div className="bf-week-list">
              {report.weeks.map(week => (
                <article key={week.week}>
                  <div className="bf-week-heading">
                    <span>Week {week.week}</span>
                    <small>{dateLabel(week.startDate)}–{dateLabel(week.endDate)}</small>
                  </div>
                  <div className="bf-week-bars">
                    <div>
                      <span>Sales</span>
                      <i style={{ width: `${Math.max(2, (week.projectedSales / maximumSales) * 100)}%` }} />
                      <strong>{formatFinanceMoney(week.projectedSales)}</strong>
                    </div>
                    <div className={week.projectedOperatingProfit < 0 ? 'negative' : ''}>
                      <span>Profit</span>
                      <i style={{ width: `${Math.max(2, (Math.abs(week.projectedOperatingProfit) / maximumProfit) * 100)}%` }} />
                      <strong>{formatFinanceMoney(week.projectedOperatingProfit)}</strong>
                    </div>
                  </div>
                  <div className="bf-week-footer">
                    <span>Expenses {formatFinanceMoney(week.projectedExpenses)}</span>
                    <span>Tax reserve {formatFinanceMoney(week.projectedTaxReserve)}</span>
                    <strong>Cash {formatFinanceMoney(week.closingCash)}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="bf-cash-controls">
            <div><span>Current cash</span><strong>{formatFinanceMoney(report.currentCash)}</strong></div>
            <div><span>Emergency reserve</span><strong>{formatFinanceMoney(report.emergencyReserve)}</strong></div>
            <div><span>Tax-reserve shortfall</span><strong>{formatFinanceMoney(report.currentTaxReserveShortfall)}</strong></div>
            <div><span>Planned sourcing cap</span><strong>{report.plannedSourcingCap > 0 ? formatFinanceMoney(report.plannedSourcingCap) : 'No separate cap'}</strong></div>
          </section>
        </>
      )}

      {view === 'profit' && (
        <>
          <section className="panel">
            <SectionHeader
              eyebrow="MONTHLY PROFIT TARGET"
              title={`${report.summary.targetProgress}% of the rolling 30-day target`}
              description="The comparison combines realised current-month operating profit with the first four forecast weeks."
              action={<JosButton variant="ghost" onClick={props.onOpenRecommendations}>CEO plan</JosButton>}
            />
            <div className="bf-target-meter">
              <div>
                <i style={{ width: `${Math.min(100, report.summary.targetProgress)}%` }} />
              </div>
              <span>{formatFinanceMoney(report.summary.rolling30DayProfit)}</span>
              <strong>{formatFinanceMoney(monthlyTarget)}</strong>
            </div>
            <div className="bf-target-grid">
              <div><span>Realised this month</span><strong>{formatFinanceMoney(report.currentMonthRealisedProfit)}</strong></div>
              <div><span>Forecast next four weeks</span><strong>{formatFinanceMoney(
                report.weeks.slice(0, 4).reduce(
                  (sum, week) => sum + week.projectedOperatingProfit,
                  0,
                ),
              )}</strong></div>
              <div><span>Remaining gap</span><strong>{formatFinanceMoney(report.summary.monthlyTargetGap)}</strong></div>
              <div><span>Weekly profit needed</span><strong>{formatFinanceMoney(report.summary.monthlyTargetGap / 4.345)}</strong></div>
            </div>
          </section>

          <section className="panel">
            <SectionHeader eyebrow="PROFIT OPPORTUNITY" title="Stock included in the forecast" compact />
            <div className="bf-candidate-list">
              {[...report.candidates]
                .sort((a, b) => b.projectedRevenue - a.projectedRevenue)
                .slice(0, 12)
                .map(candidate => (
                  <button type="button" key={`${candidate.source}-${candidate.sku}`} onClick={
                    candidate.source === 'inventory'
                      ? props.onOpenPipeline
                      : props.onOpenRecommendations
                  }>
                    <span>
                      <strong>{candidate.brand} · {candidate.sku}</strong>
                      <small>{candidate.source.replace('-', ' ')} · Week {candidate.scheduledWeek} · {(candidate.probability * 100).toFixed(0)}% scenario probability</small>
                    </span>
                    <em>{formatFinanceMoney(candidate.projectedRevenue)}</em>
                  </button>
                ))}
            </div>
          </section>
        </>
      )}

      {view === 'scenarios' && (
        <section className="panel">
          <SectionHeader
            eyebrow="SCENARIO COMPARISON"
            title="The range—not one false point estimate"
            description="Use Conservative for cash protection, Base for planning and Optimistic only as an upside case."
          />
          <div className="bf-comparison-grid">
            {(['conservative', 'base', 'optimistic'] as ForecastScenario[]).map(option => {
              const summary = report.scenarioComparison[option]
              return (
                <article className={scenario === option ? 'selected' : ''} key={option}>
                  <p className="eyebrow">{scenarioLabel(option)}</p>
                  <h3>{formatFinanceMoney(summary.projectedOperatingProfit)}</h3>
                  <span>12-week operating profit</span>
                  <dl>
                    <div><dt>Sales</dt><dd>{formatFinanceMoney(summary.projectedSales)}</dd></div>
                    <div><dt>End cash</dt><dd>{formatFinanceMoney(summary.projectedEndCash)}</dd></div>
                    <div><dt>Low cash</dt><dd>{formatFinanceMoney(summary.lowestCashPoint)}</dd></div>
                    <div><dt>Expected items</dt><dd>{summary.projectedItemsSold.toFixed(1)}</dd></div>
                    <div><dt>30-day target</dt><dd>{summary.targetProgress}%</dd></div>
                  </dl>
                  <JosButton variant={scenario === option ? 'primary' : 'secondary'} fullWidth onClick={() => setScenario(option)}>
                    Use {scenarioLabel(option)}
                  </JosButton>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {view === 'evidence' && (
        <>
          <section className="panel">
            <SectionHeader
              eyebrow="FORECAST EVIDENCE"
              title={`${report.confidenceScore}/100 confidence`}
              description={report.confidenceReason}
            />
            <div className="bf-evidence-grid">
              <div><span>Inventory data quality</span><strong>{report.evidence.inventoryDataQuality}/100</strong></div>
              <div><span>Linked sales</span><strong>{report.evidence.linkedSales}</strong></div>
              <div><span>Unlinked sales</span><strong>{report.evidence.unlinkedSales}</strong></div>
              <div><span>Sales in last 90 days</span><strong>{report.evidence.salesLast90Days}</strong></div>
              <div><span>Expense entries in 90 days</span><strong>{report.evidence.expensesLast90Days}</strong></div>
              <div><span>Stock records with dates</span><strong>{report.evidence.itemsWithDates}/{props.items.length}</strong></div>
              <div><span>Historical weekly sales</span><strong>{formatFinanceMoney(report.historicalWeeklySales)}</strong></div>
              <div><span>Forecast weekly expenses</span><strong>{formatFinanceMoney(report.historicalWeeklyExpenses)}</strong></div>
            </div>
          </section>

          {report.warnings.length > 0 && (
            <section className="bf-warnings">
              <p className="eyebrow">CURRENT LIMITS</p>
              {report.warnings.map(warning => <p key={warning}>{warning}</p>)}
            </section>
          )}

          <section className="bf-assumptions">
            <p className="eyebrow">FORECAST RULES</p>
            {report.assumptions.map(assumption => <p key={assumption}>{assumption}</p>)}
          </section>
        </>
      )}
    </main>
  )
}
