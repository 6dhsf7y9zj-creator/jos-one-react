import { useEffect, useMemo, useRef, useState } from 'react'
import type { InventoryItem, JosSettings, OrderRecord } from '../types/inventory'
import { createBackup, migrateBackup, type JosBackup } from '../lib/backup'
import {
  clearAutoBackups,
  deleteAutoBackup,
  estimateAllSnapshotBytes,
  estimateSnapshotBytes,
  findAutoBackup,
  getAutoBackups,
  saveAutoBackup,
  type AutoBackupSnapshot,
} from '../lib/autoBackup'

type BackupCenterProps = {
  items: InventoryItem[]
  orders: OrderRecord[]
  settings: JosSettings
  onRestore: (items: InventoryItem[], orders: OrderRecord[], settings: JosSettings) => void
}

type Comparison = {
  added: string[]
  removed: string[]
  changed: string[]
  ordersDelta: number
  settingsChanged: boolean
}

const UNDO_SNAPSHOT_KEY = 'jos-one-react-last-recovery-checkpoint'

function downloadJson(backup: JosBackup, filename: string): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function itemSignature(item: InventoryItem): string {
  return JSON.stringify(item)
}

function compareBackup(currentItems: InventoryItem[], currentOrders: OrderRecord[], currentSettings: JosSettings, backup: JosBackup): Comparison {
  const currentMap = new Map(currentItems.map(item => [item.sku, item]))
  const backupMap = new Map(backup.items.map(item => [item.sku, item]))

  const added = backup.items
    .filter(item => !currentMap.has(item.sku))
    .map(item => item.sku)

  const removed = currentItems
    .filter(item => !backupMap.has(item.sku))
    .map(item => item.sku)

  const changed = backup.items
    .filter(item => {
      const current = currentMap.get(item.sku)
      return current && itemSignature(current) !== itemSignature(item)
    })
    .map(item => item.sku)

  return {
    added,
    removed,
    changed,
    ordersDelta: backup.orders.length - currentOrders.length,
    settingsChanged: JSON.stringify(backup.settings) !== JSON.stringify(currentSettings),
  }
}

function backupAgeHours(createdAt: string): number {
  return Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3_600_000)
}

export function BackupCenter({ items, orders, settings, onRestore }: BackupCenterProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<ReturnType<typeof migrateBackup> | null>(null)
  const [snapshots, setSnapshots] = useState<AutoBackupSnapshot[]>([])
  const [selectedSnapshot, setSelectedSnapshot] = useState<AutoBackupSnapshot | null>(null)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [undoSnapshotId, setUndoSnapshotId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(UNDO_SNAPSHOT_KEY)
    } catch {
      return null
    }
  })

  const refreshSnapshots = () => {
    const updated = getAutoBackups()
    setSnapshots(updated)
    if (selectedSnapshot) {
      setSelectedSnapshot(updated.find(snapshot => snapshot.id === selectedSnapshot.id) ?? null)
    }
  }

  useEffect(() => {
    refreshSnapshots()
  }, [items, orders, settings])

  const latest = snapshots[0]
  const latestAge = latest ? backupAgeHours(latest.createdAt) : Infinity
  const health = !latest
    ? { label: 'No backup exists', tone: 'danger', detail: 'Create a snapshot before making more changes.' }
    : latestAge > 24
      ? { label: 'Backup needs attention', tone: 'warning', detail: 'The latest snapshot is more than 24 hours old.' }
      : { label: 'Protected', tone: 'healthy', detail: 'Automatic backups are current.' }

  const totalStorage = useMemo(() => estimateAllSnapshotBytes(), [snapshots])
  const comparison = useMemo(
    () => selectedSnapshot ? compareBackup(items, orders, settings, selectedSnapshot.backup) : null,
    [items, orders, settings, selectedSnapshot],
  )

  const chooseFile = () => fileInput.current?.click()

  const readBackup = async (file?: File) => {
    if (!file) return
    setMessage('')
    setPending(null)
    try {
      const parsed = JSON.parse(await file.text())
      const migrated = migrateBackup(parsed)
      setPending(migrated)
      setMessage(`Ready to restore ${migrated.items.length} items and ${migrated.orders.length} orders.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The backup could not be read.')
    }
  }

  const createRecoveryCheckpoint = (): AutoBackupSnapshot | null => {
    const checkpoint = saveAutoBackup(items, orders, settings, 'manual')
    if (checkpoint) {
      try {
        localStorage.setItem(UNDO_SNAPSHOT_KEY, checkpoint.id)
      } catch {
        // The restore can continue even if the undo pointer cannot be saved.
      }
      setUndoSnapshotId(checkpoint.id)
    }
    return checkpoint
  }

  const applyRestore = (backup: JosBackup, description: string) => {
    const checkpoint = createRecoveryCheckpoint()
    onRestore(backup.items, backup.orders, backup.settings)
    setMessage(
      `${description} restored successfully.` +
      (checkpoint ? ' Your previous state can be restored with Undo last recovery.' : ''),
    )
    setRecoveryOpen(false)
    setSelectedSnapshot(null)
    window.setTimeout(refreshSnapshots, 100)
  }

  const restoreImportedFile = () => {
    if (!pending) return
    applyRestore(pending, `Backup containing ${pending.items.length} items`)
    setPending(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  const downloadBackup = () => {
    const backup = createBackup(items, orders, settings)
    downloadJson(backup, `JOS-One-backup-${new Date().toISOString().slice(0, 10)}.json`)
    saveAutoBackup(items, orders, settings, 'manual')
    refreshSnapshots()
    setMessage(`Backup exported with ${items.length} items.`)
  }

  const createSnapshotNow = () => {
    saveAutoBackup(items, orders, settings, 'manual')
    refreshSnapshots()
    setMessage('A local safety snapshot has been created.')
  }

  const openRecovery = (snapshot: AutoBackupSnapshot) => {
    setSelectedSnapshot(snapshot)
    setRecoveryOpen(true)
    setMessage('')
  }

  const restoreSelectedSnapshot = () => {
    if (!selectedSnapshot) return
    applyRestore(
      selectedSnapshot.backup,
      `Snapshot from ${formatDate(selectedSnapshot.createdAt)}`,
    )
  }

  const undoLastRecovery = () => {
    if (!undoSnapshotId) return
    const checkpoint = findAutoBackup(undoSnapshotId)
    if (!checkpoint) {
      setMessage('The recovery checkpoint is no longer available.')
      setUndoSnapshotId(null)
      try {
        localStorage.removeItem(UNDO_SNAPSHOT_KEY)
      } catch {}
      return
    }

    onRestore(checkpoint.backup.items, checkpoint.backup.orders, checkpoint.backup.settings)
    setMessage(`Recovery undone. Restored your data from ${formatDate(checkpoint.createdAt)}.`)
    setUndoSnapshotId(null)
    try {
      localStorage.removeItem(UNDO_SNAPSHOT_KEY)
    } catch {}
    window.setTimeout(refreshSnapshots, 100)
  }

  const downloadSnapshot = (snapshot: AutoBackupSnapshot) => {
    const date = snapshot.createdAt.replace(/[:.]/g, '-')
    downloadJson(snapshot.backup, `JOS-One-auto-backup-${date}.json`)
  }

  const removeSnapshot = (id: string) => {
    deleteAutoBackup(id)
    if (undoSnapshotId === id) {
      setUndoSnapshotId(null)
      try {
        localStorage.removeItem(UNDO_SNAPSHOT_KEY)
      } catch {}
    }
    refreshSnapshots()
  }

  const removeAllSnapshots = () => {
    if (!window.confirm('Delete all local automatic snapshots? Downloaded backup files will not be affected.')) return
    clearAutoBackups()
    setUndoSnapshotId(null)
    try {
      localStorage.removeItem(UNDO_SNAPSHOT_KEY)
    } catch {}
    refreshSnapshots()
    setMessage('Local automatic snapshots were deleted.')
  }

  return (
    <main className="screen backup-screen">
      <section className="panel backup-hero">
        <p className="eyebrow">BACKUP HEALTH</p>
        <h2>{health.label}</h2>
        <p>{health.detail}</p>

        <div className={`backup-health health-${health.tone}`}>
          <span className={`backup-dot ${health.tone}`} />
          <div>
            <strong>{latest ? `Latest backup: ${formatDate(latest.createdAt)}` : 'No snapshot available'}</strong>
            <small>
              {latest
                ? `${latest.itemCount} inventory items · ${latest.orderCount} orders · ${formatBytes(estimateSnapshotBytes(latest))}`
                : 'Create a snapshot now to protect the current business state.'}
            </small>
          </div>
        </div>

        <div className="backup-health-grid">
          <div><span>Snapshots kept</span><strong>{snapshots.length}/10</strong></div>
          <div><span>Local storage used</span><strong>{formatBytes(totalStorage)}</strong></div>
          <div><span>Inventory protected</span><strong>{latest?.itemCount ?? 0}</strong></div>
          <div><span>Orders protected</span><strong>{latest?.orderCount ?? 0}</strong></div>
        </div>

        <button type="button" className="secondary-action" onClick={createSnapshotNow}>
          Create snapshot now
        </button>

        {undoSnapshotId && (
          <button type="button" className="undo-recovery-action" onClick={undoLastRecovery}>
            Undo last recovery
          </button>
        )}
      </section>

      <section className="panel backup-card">
        <p className="eyebrow">RECOVERY MODE</p>
        <h2>Rolling snapshots</h2>
        <p>
          Review the effect of an older snapshot before restoring it. JOS creates a checkpoint
          of your current data first, so the recovery can be undone.
        </p>

        {snapshots.length === 0 ? (
          <div className="empty-backups">No local snapshots are available yet.</div>
        ) : (
          <div className="snapshot-list">
            {snapshots.map((snapshot, index) => (
              <article className="snapshot-row" key={snapshot.id}>
                <div className="snapshot-main">
                  <span className="snapshot-number">{index + 1}</span>
                  <div>
                    <strong>{formatDate(snapshot.createdAt)}</strong>
                    <small>
                      {snapshot.itemCount} items · {snapshot.orderCount} orders ·{' '}
                      {formatBytes(estimateSnapshotBytes(snapshot))} ·{' '}
                      {snapshot.reason === 'automatic' ? 'Automatic' : 'Manual'}
                    </small>
                  </div>
                </div>
                <div className="snapshot-actions recovery-actions">
                  <button type="button" onClick={() => openRecovery(snapshot)}>Review</button>
                  <button type="button" onClick={() => downloadSnapshot(snapshot)}>Download</button>
                  <button type="button" className="text-danger" onClick={() => removeSnapshot(snapshot.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {snapshots.length > 0 && (
          <button type="button" className="text-action danger-text-action" onClick={removeAllSnapshots}>
            Delete all local snapshots
          </button>
        )}
      </section>

      {recoveryOpen && selectedSnapshot && comparison && (
        <section className="recovery-overlay" role="dialog" aria-modal="true" aria-label="Review recovery">
          <div className="recovery-dialog">
            <button type="button" className="recovery-close" onClick={() => setRecoveryOpen(false)} aria-label="Close">
              ×
            </button>
            <p className="eyebrow">RECOVERY PREVIEW</p>
            <h2>{formatDate(selectedSnapshot.createdAt)}</h2>
            <p>
              This snapshot contains <strong>{selectedSnapshot.itemCount} inventory items</strong> and{' '}
              <strong>{selectedSnapshot.orderCount} orders</strong>.
            </p>

            <div className="recovery-comparison">
              <div className="compare-card positive">
                <span>Items recovered</span>
                <strong>{comparison.added.length}</strong>
                <small>{comparison.added.slice(0, 3).join(', ') || 'None'}</small>
              </div>
              <div className="compare-card negative">
                <span>Current items removed</span>
                <strong>{comparison.removed.length}</strong>
                <small>{comparison.removed.slice(0, 3).join(', ') || 'None'}</small>
              </div>
              <div className="compare-card warning">
                <span>Items changed</span>
                <strong>{comparison.changed.length}</strong>
                <small>{comparison.changed.slice(0, 3).join(', ') || 'None'}</small>
              </div>
              <div className="compare-card neutral">
                <span>Order count change</span>
                <strong>{comparison.ordersDelta > 0 ? '+' : ''}{comparison.ordersDelta}</strong>
                <small>{comparison.settingsChanged ? 'Settings will also change' : 'Settings unchanged'}</small>
              </div>
            </div>

            {(comparison.added.length + comparison.removed.length + comparison.changed.length === 0 &&
              comparison.ordersDelta === 0 && !comparison.settingsChanged) && (
              <div className="no-recovery-change">This snapshot matches your current data.</div>
            )}

            <button type="button" className="danger-action" onClick={restoreSelectedSnapshot}>
              Restore this snapshot
            </button>
            <button type="button" className="secondary-action" onClick={() => setRecoveryOpen(false)}>
              Cancel
            </button>
            <p className="recovery-note">
              JOS will save your current state first and enable “Undo last recovery”.
            </p>
          </div>
        </section>
      )}

      <section className="panel backup-card">
        <p className="eyebrow">DOWNLOAD</p>
        <h2>Off-device safety copy</h2>
        <p>
          Download this file to iCloud Drive or Files. This is the copy that protects you if
          Safari data is cleared or the phone is lost.
        </p>
        <dl className="backup-summary">
          <div><dt>Inventory items</dt><dd>{items.length}</dd></div>
          <div><dt>Orders</dt><dd>{orders.length}</dd></div>
          <div><dt>Minimum profit</dt><dd>£{settings.minimumProfit.toFixed(2)}</dd></div>
        </dl>
        <button type="button" className="primary-action" onClick={downloadBackup}>Download full backup</button>
      </section>

      <section className="panel backup-card">
        <p className="eyebrow">RESTORE FILE</p>
        <h2>Import a JOS backup</h2>
        <p>JOS checks the JSON file before replacing your current records and saves your current state first.</p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={event => readBackup(event.target.files?.[0])}
        />
        <button type="button" className="primary-action" onClick={chooseFile}>Choose backup file</button>

        {message && <div className={`restore-message ${pending ? 'ready' : ''}`}>{message}</div>}

        {pending && (
          <div className="restore-preview">
            <div><span>Inventory</span><strong>{pending.items.length}</strong></div>
            <div><span>Orders</span><strong>{pending.orders.length}</strong></div>
            <div><span>Backup version</span><strong>{pending.version}</strong></div>
            <button type="button" className="danger-action" onClick={restoreImportedFile}>Restore this backup</button>
            <p>Your current state is saved as a local snapshot before restoration.</p>
          </div>
        )}
      </section>
    </main>
  )
}
