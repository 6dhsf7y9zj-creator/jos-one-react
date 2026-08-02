import { useMemo, useState } from 'react'
import type {
  AutomationRuleId,
  AutomationSettings,
  InventoryItem,
  JosSettings,
  OrderRecord,
} from '../types/inventory'
import {
  calculateAutomationReport,
  completeAutomationRule,
  normaliseAutomationSettings,
  setAutomationLaunchDate,
  setAutomationRuleEnabled,
  snoozeAutomationRule,
  toggleLaunchChecklistItem,
  type AutomationAlert,
  type AutomationDestination,
  type AutomationRuleView,
} from '../lib/automationCentre'
import {
  getAutoBackups,
  getLastOffDeviceExportAt,
  saveAutoBackup,
} from '../lib/autoBackup'
import { formatFinanceMoney } from '../lib/finance'
import { EmptyState, JosButton, KpiCard, NoticeCard, SectionHeader } from '../ui'

type Props = {
  items: InventoryItem[]
  orders: OrderRecord[]
  settings: JosSettings
  onChangeAutomation: (automation: AutomationSettings) => void
  onOpenRecommendations: () => void
  onOpenBackup: () => void
  onOpenInventoryIntelligence: () => void
  onOpenFinance: () => void
}

type View = 'today' | 'rules' | 'launch' | 'evidence'

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

function dateOnly(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function destinationAction(
  destination: AutomationDestination,
  props: Props,
  openLaunch: () => void,
): () => void {
  if (destination === 'recommendations') return props.onOpenRecommendations
  if (destination === 'backup') return props.onOpenBackup
  if (destination === 'inventory-intelligence') return props.onOpenInventoryIntelligence
  if (destination === 'finance') return props.onOpenFinance
  return openLaunch
}

function alertTone(
  severity: AutomationAlert['severity'],
): 'positive' | 'warning' | 'urgent' | 'information' {
  if (severity === 'critical') return 'urgent'
  if (severity === 'warning') return 'warning'
  if (severity === 'positive') return 'positive'
  return 'information'
}

function RuleCard({
  rule,
  props,
  onComplete,
  onSnooze,
  onToggle,
  openLaunch,
  showToggle = false,
}: {
  rule: AutomationRuleView
  props: Props
  onComplete: (id: AutomationRuleId) => void
  onSnooze: (id: AutomationRuleId) => void
  onToggle: (id: AutomationRuleId, enabled: boolean) => void
  openLaunch: () => void
  showToggle?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <article className={`ac-rule status-${rule.status} severity-${rule.severity}`}>
      <button
        type="button"
        className="ac-rule-main"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
      >
        <span className="ac-rule-icon" aria-hidden="true">
          {rule.status === 'overdue'
            ? '!'
            : rule.status === 'due'
              ? '•'
              : rule.status === 'snoozed'
                ? '◷'
                : rule.status === 'disabled'
                  ? '–'
                  : '✓'}
        </span>
        <span className="ac-rule-copy">
          <strong>{rule.title}</strong>
          <small>{rule.dynamicDetail}</small>
        </span>
        <span className="ac-rule-status">{rule.statusLabel}</span>
      </button>

      <div className="ac-rule-meta">
        <span>{rule.cadenceLabel}</span>
        <span>Due {dateOnly(rule.dueAt)}</span>
        <span>Last complete {dateTime(rule.lastCompletedAt)}</span>
      </div>

      {expanded && (
        <div className="ac-rule-evidence">
          <p>{rule.description}</p>
          {rule.evidence.map(item => <span key={item}>{item}</span>)}
        </div>
      )}

      <div className="ac-rule-actions">
        <JosButton
          variant="secondary"
          onClick={destinationAction(rule.destination, props, openLaunch)}
        >
          {rule.actionLabel}
        </JosButton>
        {rule.enabled && (
          <JosButton variant="primary" onClick={() => onComplete(rule.id)}>
            Mark complete
          </JosButton>
        )}
        {rule.enabled && (rule.status === 'due' || rule.status === 'overdue') && (
          <JosButton variant="ghost" onClick={() => onSnooze(rule.id)}>
            Snooze 1 day
          </JosButton>
        )}
      </div>

      {showToggle && (
        <label className="ac-enable-toggle">
          <span>{rule.enabled ? 'Automation enabled' : 'Automation disabled'}</span>
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={event => onToggle(rule.id, event.target.checked)}
          />
        </label>
      )}
    </article>
  )
}

export function AutomationCentre(props: Props) {
  const [view, setView] = useState<View>('today')
  const [message, setMessage] = useState('')
  const [backupRefresh, setBackupRefresh] = useState(0)

  const backupEvidence = useMemo(() => {
    const snapshots = getAutoBackups()
    return {
      latestAutoBackupAt: snapshots[0]?.createdAt,
      lastOffDeviceExportAt: getLastOffDeviceExportAt(),
    }
  }, [props.items, props.orders, props.settings, backupRefresh])

  const automation = useMemo(
    () => normaliseAutomationSettings(props.settings.automation),
    [props.settings.automation],
  )

  const report = useMemo(
    () => calculateAutomationReport(
      props.items,
      props.orders,
      {
        ...props.settings,
        automation,
      },
      backupEvidence,
    ),
    [props.items, props.orders, props.settings, automation, backupEvidence],
  )

  const update = (next: AutomationSettings) => {
    props.onChangeAutomation(next)
  }

  const complete = (id: AutomationRuleId) => {
    update(completeAutomationRule(automation, id))
    setMessage('Automation review marked complete. Its next due date has been scheduled.')
  }

  const snooze = (id: AutomationRuleId) => {
    update(snoozeAutomationRule(automation, id, 1))
    setMessage('Reminder snoozed for one day. The underlying business issue remains unchanged.')
  }

  const toggle = (id: AutomationRuleId, enabled: boolean) => {
    update(setAutomationRuleEnabled(automation, id, enabled))
    setMessage(enabled ? 'Automation enabled.' : 'Automation disabled.')
  }

  const createSnapshot = () => {
    const saved = saveAutoBackup(
      props.items,
      props.orders,
      {
        ...props.settings,
        automation,
      },
      'manual',
    )
    if (!saved) {
      setMessage('The snapshot could not be saved on this device.')
      return
    }
    update(completeAutomationRule(automation, 'weekly-backup-check'))
    setBackupRefresh(value => value + 1)
    setMessage('Manual snapshot created and the weekly backup check was marked complete.')
  }

  const openLaunch = () => setView('launch')

  const views: Array<{ key: View; label: string }> = [
    { key: 'today', label: 'Today' },
    { key: 'rules', label: 'Routines' },
    { key: 'launch', label: 'Launch readiness' },
    { key: 'evidence', label: 'How it works' },
  ]

  return (
    <main className="screen automation-centre">
      <section className="ac-hero">
        <div>
          <p className="eyebrow">AUTOMATION CENTRE</p>
          <h2>Keep the important checks from being forgotten</h2>
          <p>
            JOS schedules recurring business reviews, surfaces evidence-based alerts and
            records completion. Checks run when the app is opened or its data changes.
          </p>
        </div>
        <div className={`ac-due-score ${report.overdueCount > 0 ? 'has-overdue' : ''}`}>
          <span>Due routines</span>
          <strong>{report.dueCount + report.overdueCount}</strong>
          <small>{report.overdueCount} overdue · {report.completedLast7Days} completed this week</small>
        </div>
      </section>

      {message && (
        <NoticeCard title={message} tone="positive" onDismiss={() => setMessage('')} />
      )}

      <NoticeCard
        title="In-app automation"
        tone="information"
      >
        JOS checks these routines while the app is open. This release does not run background
        jobs or send alerts while the browser is closed.
      </NoticeCard>

      <section className="jos-kpi-grid ac-kpi-grid">
        <KpiCard
          label="Due today"
          value={report.dueCount}
          detail={`${report.overdueCount} overdue routines`}
          tone={report.overdueCount > 0 ? 'urgent' : report.dueCount > 0 ? 'warning' : 'positive'}
        />
        <KpiCard
          label="Active alerts"
          value={report.alerts.length}
          detail="Evidence-based business warnings"
          tone={report.alerts.some(alert => alert.severity === 'critical') ? 'urgent' : report.alerts.length ? 'warning' : 'positive'}
        />
        <KpiCard
          label="Latest backup"
          value={
            report.latestBackupAgeDays === undefined
              ? 'None'
              : `${report.latestBackupAgeDays.toFixed(1)} days`
          }
          detail={
            report.offDeviceExportAgeDays === undefined
              ? 'No off-device export recorded'
              : `Off-device export ${report.offDeviceExportAgeDays.toFixed(1)} days ago`
          }
          tone={
            report.latestBackupAgeDays === undefined ||
            (report.latestBackupAgeDays ?? 0) > 1
              ? 'urgent'
              : 'positive'
          }
          onClick={props.onOpenBackup}
        />
        <KpiCard
          label="Launch readiness"
          value={`${report.launch.progress}%`}
          detail={`${report.launch.completed}/${report.launch.total} complete · ${report.launch.daysRemaining} days`}
          tone={
            report.launch.daysRemaining <= 30 && report.launch.progress < 100
              ? 'warning'
              : report.launch.progress === 100
                ? 'positive'
                : 'information'
          }
          onClick={openLaunch}
        />
        <KpiCard
          label="Ageing stock"
          value={report.evidence.ageingItems}
          detail={`${formatFinanceMoney(report.evidence.ageingCash)} purchase cash under review`}
          tone={report.evidence.ageingItems > 0 ? 'warning' : 'positive'}
          onClick={props.onOpenInventoryIntelligence}
        />
        <KpiCard
          label="Finance entries"
          value={report.evidence.financeTransactionsLast7Days}
          detail={`Last 7 days · ${formatFinanceMoney(report.evidence.taxReserveShortfall)} reserve shortfall`}
          tone={report.evidence.taxReserveShortfall > 0 ? 'warning' : 'information'}
          onClick={props.onOpenFinance}
        />
      </section>

      <section className="ac-tabs" aria-label="Automation Centre views">
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
        <>
          {report.alerts.length > 0 && (
            <section className="panel">
              <SectionHeader
                eyebrow="BUSINESS ALERTS"
                title="Current evidence requiring attention"
                description="Alerts come from live JOS records and remain separate from scheduled routine completion."
              />
              <div className="ac-alert-list">
                {report.alerts.map(alert => (
                  <NoticeCard
                    key={alert.id}
                    title={alert.title}
                    tone={alertTone(alert.severity)}
                  >
                    <p>{alert.detail}</p>
                    <JosButton
                      variant="ghost"
                      onClick={destinationAction(alert.destination, props, openLaunch)}
                    >
                      {alert.actionLabel}
                    </JosButton>
                  </NoticeCard>
                ))}
              </div>
            </section>
          )}

          <section className="panel">
            <SectionHeader
              eyebrow="DUE ROUTINES"
              title="Reviews that need acknowledgement"
              description="Open the relevant module, complete the real work, then mark the routine complete."
              action={
                report.dueRules.some(rule => rule.id === 'weekly-backup-check')
                  ? <JosButton variant="ghost" onClick={createSnapshot}>Create snapshot</JosButton>
                  : undefined
              }
            />
            {report.dueRules.length === 0 ? (
              <EmptyState
                title="All routines are current"
                description="Upcoming routines remain visible in the Routines tab."
              />
            ) : (
              <div className="ac-rule-list">
                {report.dueRules.map(rule => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    props={props}
                    onComplete={complete}
                    onSnooze={snooze}
                    onToggle={toggle}
                    openLaunch={openLaunch}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {view === 'rules' && (
        <section className="panel">
          <SectionHeader
            eyebrow="RECURRING ROUTINES"
            title="Your operating rhythm"
            description="Disable a routine only when you deliberately no longer need that control."
          />
          <div className="ac-rule-list">
            {report.rules.map(rule => (
              <RuleCard
                key={rule.id}
                rule={rule}
                props={props}
                onComplete={complete}
                onSnooze={snooze}
                onToggle={toggle}
                openLaunch={openLaunch}
                showToggle
              />
            ))}
          </div>
        </section>
      )}

      {view === 'launch' && (
        <>
          <section className={`ac-launch-summary launch-${report.launch.status}`}>
            <div>
              <p className="eyebrow light">JANUARY 2027 LAUNCH</p>
              <h2>{report.launch.daysRemaining} days remaining</h2>
              <p>
                {report.launch.completed} of {report.launch.total} readiness checks are complete.
                Completion is manual and should only be confirmed after the work is genuinely finished.
              </p>
            </div>
            <div className="ac-launch-progress">
              <div><i style={{ width: `${report.launch.progress}%` }} /></div>
              <strong>{report.launch.progress}%</strong>
            </div>
            <label>
              Planned launch date
              <input
                type="date"
                value={automation.launchDate}
                onChange={event => update(
                  setAutomationLaunchDate(automation, event.target.value),
                )}
              />
            </label>
          </section>

          <section className="panel">
            <SectionHeader
              eyebrow="LAUNCH READINESS CHECKLIST"
              title="Preparation that still needs confirmation"
              description="JOS does not infer legal, banking, marketing or physical preparation from unrelated app records."
            />
            <div className="ac-launch-list">
              {report.launch.items.map(item => (
                <label className={item.completed ? 'complete' : ''} key={item.id}>
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => update(
                      toggleLaunchChecklistItem(automation, item.id),
                    )}
                  />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                    {item.completedAt && <em>Completed {dateTime(item.completedAt)}</em>}
                  </span>
                </label>
              ))}
            </div>
            <JosButton
              variant="secondary"
              fullWidth
              onClick={() => complete('weekly-launch-review')}
            >
              Mark launch review complete
            </JosButton>
          </section>
        </>
      )}

      {view === 'evidence' && (
        <>
          <section className="panel">
            <SectionHeader
              eyebrow="AUTOMATION EVIDENCE"
              title="What the routines are currently watching"
              description="Scheduled reminders and live alerts are deliberately kept separate."
            />
            <div className="ac-evidence-grid">
              <div><span>CEO actions today</span><strong>{report.evidence.todayRecommendations}</strong></div>
              <div><span>Customer commitments</span><strong>{report.evidence.customerCommitments}</strong></div>
              <div><span>Ageing live items</span><strong>{report.evidence.ageingItems}</strong></div>
              <div><span>Inventory data quality</span><strong>{report.evidence.inventoryDataQuality}/100</strong></div>
              <div><span>Finance entries in 7 days</span><strong>{report.evidence.financeTransactionsLast7Days}</strong></div>
              <div><span>Completed routines in 7 days</span><strong>{report.completedLast7Days}</strong></div>
            </div>
          </section>

          <section className="ac-limitations">
            <p className="eyebrow">AUTOMATION BOUNDARIES</p>
            {report.limitations.map(item => <p key={item}>{item}</p>)}
          </section>
        </>
      )}
    </main>
  )
}
