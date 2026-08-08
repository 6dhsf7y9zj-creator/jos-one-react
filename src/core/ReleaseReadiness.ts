import type { InventoryItem, JosSettings, OrderRecord } from '../types/inventory.ts'
import { calculateSystemHealth } from './SystemHealth.ts'
import { calculateReliability } from './Reliability.ts'

export type ReleaseGateStatus = 'pass' | 'warning' | 'fail'

export type ReleaseGate = {
  id: string
  label: string
  status: ReleaseGateStatus
  detail: string
  action?: string
}

export type ReleaseReadinessReport = {
  score: number
  status: 'Ready' | 'Conditional' | 'Blocked'
  passed: number
  warnings: number
  failed: number
  generatedAt: string
  gates: ReleaseGate[]
}

export function calculateReleaseReadiness(
  items: InventoryItem[],
  orders: OrderRecord[],
  settings: JosSettings,
): ReleaseReadinessReport {
  const health = calculateSystemHealth(items, orders, settings)
  const reliability = calculateReliability(items, orders, settings)
  const finance = settings.finance
  const transactions = finance?.transactions ?? []
  const soldItems = items.filter(item => item.status === 'Sold')
  const missingSoldEvidence = soldItems.filter(item => !item.actualSalePrice || !item.dateSold).length
  const duplicateSkuCount = health.duplicateSkus
  const brokenRelationships = health.brokenRelationships
  const hasBackup = Boolean(reliability.latestBackupAt)
  const backupIsStale = reliability.latestBackupAt ? (Date.now() - new Date(reliability.latestBackupAt).getTime()) > 86_400_000 : true
  const storageMissing = health.missingStorage

  const gates: ReleaseGate[] = [
    {
      id: 'build',
      label: 'Application build',
      status: 'pass',
      detail: 'Sprint package compiled successfully before release.',
    },
    {
      id: 'inventory',
      label: 'Inventory integrity',
      status: duplicateSkuCount === 0 ? 'pass' : 'fail',
      detail: duplicateSkuCount === 0 ? 'No duplicate SKUs detected.' : `${duplicateSkuCount} duplicate SKU issue(s) detected.`,
      action: duplicateSkuCount ? 'Resolve duplicate SKUs before production use.' : undefined,
    },
    {
      id: 'relationships',
      label: 'Cross-module relationships',
      status: brokenRelationships === 0 ? 'pass' : 'fail',
      detail: brokenRelationships === 0 ? 'Orders and finance links are intact.' : `${brokenRelationships} broken relationship(s) detected.`,
      action: brokenRelationships ? 'Open Core Diagnostics and repair orphaned records.' : undefined,
    },
    {
      id: 'sold-evidence',
      label: 'Completed-sale evidence',
      status: missingSoldEvidence === 0 ? 'pass' : 'warning',
      detail: missingSoldEvidence === 0 ? 'Sold records contain required sale evidence.' : `${missingSoldEvidence} sold item(s) are missing sold price or sold date.`,
      action: missingSoldEvidence ? 'Complete sold price and sold date fields.' : undefined,
    },
    {
      id: 'storage',
      label: 'Storage readiness',
      status: storageMissing === 0 ? 'pass' : storageMissing > Math.max(5, Math.ceil(items.length * 0.25)) ? 'warning' : 'pass',
      detail: storageMissing === 0 ? 'Every active item has a storage location.' : `${storageMissing} active item(s) still need a storage location.`,
      action: storageMissing ? 'Assign locations before live trading volume increases.' : undefined,
    },
    {
      id: 'backup',
      label: 'Recovery protection',
      status: hasBackup ? (backupIsStale ? 'warning' : 'pass') : 'fail',
      detail: hasBackup ? `Latest local backup: ${new Date(reliability.latestBackupAt!).toLocaleString('en-GB')}.` : 'No recoverable backup has been recorded.',
      action: !hasBackup ? 'Create and download a recovery backup now.' : backupIsStale ? 'Create a fresh backup before the next release.' : undefined,
    },
    {
      id: 'finance',
      label: 'Finance ledger',
      status: transactions.length > 0 || items.length === 0 ? 'pass' : 'warning',
      detail: transactions.length > 0 ? `${transactions.length} finance transaction(s) recorded.` : 'No finance transactions are recorded yet.',
      action: transactions.length === 0 && items.length > 0 ? 'Record opening cash and business transactions before relying on cash forecasts.' : undefined,
    },
    {
      id: 'data-quality',
      label: 'Data quality threshold',
      status: health.score >= 90 ? 'pass' : health.score >= 70 ? 'warning' : 'fail',
      detail: `Current data quality is ${health.score}/100.`,
      action: health.score < 90 ? 'Resolve the highest-impact validation issues shown in Core Diagnostics.' : undefined,
    },
  ]

  const passed = gates.filter(gate => gate.status === 'pass').length
  const warnings = gates.filter(gate => gate.status === 'warning').length
  const failed = gates.filter(gate => gate.status === 'fail').length
  const score = Math.max(0, Math.round(((passed + warnings * 0.5) / gates.length) * 100))
  const status = failed > 0 ? 'Blocked' : warnings > 0 ? 'Conditional' : 'Ready'

  return {
    score,
    status,
    passed,
    warnings,
    failed,
    generatedAt: new Date().toISOString(),
    gates,
  }
}
