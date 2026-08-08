import type { InventoryItem, JosSettings, OrderRecord } from '../types/inventory.ts'
import { getAutoBackups, getLastOffDeviceExportAt, estimateAllSnapshotBytes } from '../lib/autoBackup.ts'
import { getAuditStorageBytes } from './EventBus.ts'
import { inspectRelationships } from './RelationshipEngine.ts'

export type ReliabilityStatus = 'protected' | 'attention' | 'risk'

export type ReliabilityReport = {
  status: ReliabilityStatus
  score: number
  latestBackupAt?: string
  autoBackupCount: number
  verifiedRelationshipFaults: number
  lastOffDeviceExportAt?: string
  localStorageBytes: number
  auditBytes: number
  backupBytes: number
  issues: string[]
}

function storageBytes(): number {
  try {
    let total = 0
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key) continue
      total += key.length + (localStorage.getItem(key)?.length ?? 0)
    }
    return total * 2
  } catch {
    return 0
  }
}

function ageHours(value?: string): number {
  if (!value) return Infinity
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return Infinity
  return Math.max(0, (Date.now() - time) / 3_600_000)
}

export function calculateReliability(
  items: InventoryItem[],
  orders: OrderRecord[],
  settings: JosSettings,
): ReliabilityReport {
  const backups = getAutoBackups()
  const latestBackupAt = backups[0]?.createdAt
  const lastOffDeviceExportAt = getLastOffDeviceExportAt()
  const relationships = inspectRelationships(items, orders, settings)
  const relationshipFaults =
    relationships.duplicateSkus.length +
    relationships.orphanOrderIds.length +
    relationships.orphanFinanceTransactionIds.length +
    relationships.soldItemsWithoutOrderOrSale.length

  const issues: string[] = []
  let score = 100
  if (backups.length === 0) {
    score -= 35
    issues.push('No automatic recovery snapshot exists.')
  } else if (ageHours(latestBackupAt) > 24) {
    score -= 15
    issues.push('The latest local recovery snapshot is over 24 hours old.')
  }
  if (!lastOffDeviceExportAt) {
    score -= 20
    issues.push('No off-device backup export has been recorded.')
  } else if (ageHours(lastOffDeviceExportAt) > 168) {
    score -= 10
    issues.push('The last off-device export is more than seven days old.')
  }
  if (relationshipFaults > 0) {
    score -= Math.min(30, relationshipFaults * 5)
    issues.push(`${relationshipFaults} data relationship fault${relationshipFaults === 1 ? '' : 's'} require attention.`)
  }
  score = Math.max(0, Math.round(score))

  return {
    status: score >= 80 ? 'protected' : score >= 55 ? 'attention' : 'risk',
    score,
    latestBackupAt,
    autoBackupCount: backups.length,
    verifiedRelationshipFaults: relationshipFaults,
    lastOffDeviceExportAt,
    localStorageBytes: storageBytes(),
    auditBytes: getAuditStorageBytes(),
    backupBytes: estimateAllSnapshotBytes(),
    issues,
  }
}
