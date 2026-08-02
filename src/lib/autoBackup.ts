import { createBackup, type JosBackup } from './backup'
import type { InventoryItem, JosSettings, OrderRecord } from '../types/inventory'

const AUTO_BACKUP_KEY = 'jos-one-react-auto-backups'
export const LAST_OFF_DEVICE_EXPORT_KEY = 'jos-one-react-last-off-device-export'
const MAX_SNAPSHOTS = 10

export type AutoBackupSnapshot = {
  id: string
  createdAt: string
  reason: 'automatic' | 'manual'
  itemCount: number
  orderCount: number
  backup: JosBackup
}

function safeParseSnapshots(value: string | null): AutoBackupSnapshot[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is AutoBackupSnapshot =>
      Boolean(
        entry &&
        typeof entry === 'object' &&
        typeof entry.id === 'string' &&
        typeof entry.createdAt === 'string' &&
        entry.backup &&
        typeof entry.backup === 'object',
      ),
    )
  } catch {
    return []
  }
}

function backupFingerprint(backup: JosBackup): string {
  return JSON.stringify({
    items: backup.items,
    orders: backup.orders,
    settings: backup.settings,
  })
}

export function getAutoBackups(): AutoBackupSnapshot[] {
  try {
    return safeParseSnapshots(localStorage.getItem(AUTO_BACKUP_KEY))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch {
    return []
  }
}

export function saveAutoBackup(
  items: InventoryItem[],
  orders: OrderRecord[],
  settings: JosSettings,
  reason: AutoBackupSnapshot['reason'] = 'automatic',
): AutoBackupSnapshot | null {
  try {
    const backup = createBackup(items, orders, settings)
    const existing = getAutoBackups()
    const latest = existing[0]

    // Do not create repeated snapshots when nothing has changed.
    if (latest && backupFingerprint(latest.backup) === backupFingerprint(backup)) {
      return latest
    }

    const createdAt = new Date().toISOString()
    const snapshot: AutoBackupSnapshot = {
      id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt,
      reason,
      itemCount: items.length,
      orderCount: orders.length,
      backup,
    }

    localStorage.setItem(
      AUTO_BACKUP_KEY,
      JSON.stringify([snapshot, ...existing].slice(0, MAX_SNAPSHOTS)),
    )
    return snapshot
  } catch {
    return null
  }
}

export function deleteAutoBackup(id: string): void {
  try {
    const remaining = getAutoBackups().filter(snapshot => snapshot.id !== id)
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(remaining))
  } catch {
    // Storage may be blocked or full. The app must continue working.
  }
}

export function clearAutoBackups(): void {
  try {
    localStorage.removeItem(AUTO_BACKUP_KEY)
  } catch {
    // Storage may be unavailable.
  }
}


export function estimateSnapshotBytes(snapshot: AutoBackupSnapshot): number {
  try {
    return new Blob([JSON.stringify(snapshot)]).size
  } catch {
    return JSON.stringify(snapshot).length
  }
}

export function estimateAllSnapshotBytes(): number {
  return getAutoBackups().reduce((total, snapshot) => total + estimateSnapshotBytes(snapshot), 0)
}

export function findAutoBackup(id: string): AutoBackupSnapshot | undefined {
  return getAutoBackups().find(snapshot => snapshot.id === id)
}


export function getLastOffDeviceExportAt(): string | undefined {
  try {
    return localStorage.getItem(LAST_OFF_DEVICE_EXPORT_KEY) ?? undefined
  } catch {
    return undefined
  }
}
