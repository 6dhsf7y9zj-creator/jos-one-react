import { useEffect, useRef, useState } from 'react'
import type { InventoryItem, JosSettings, OrderRecord } from '../types/inventory'
import { createBackup, migrateBackup, type JosBackup } from '../lib/backup'
import {
  clearAutoBackups,
  deleteAutoBackup,
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

export function BackupCenter({ items, orders, settings, onRestore }: BackupCenterProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<ReturnType<typeof migrateBackup> | null>(null)
  const [snapshots, setSnapshots] = useState<AutoBackupSnapshot[]>([])

  const refreshSnapshots = () => setSnapshots(getAutoBackups())

  useEffect(() => {
    refreshSnapshots()
  }, [items, orders, settings])

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

  const restore = () => {
    if (!pending) return
    saveAutoBackup(items, orders, settings, 'manual')
    onRestore(pending.items, pending.orders, pending.settings)
    setMessage(`Restored ${pending.items.length} inventory items successfully.`)
    setPending(null)
    if (fileInput.current) fileInput.current.value = ''
    window.setTimeout(refreshSnapshots, 100)
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

  const restoreSnapshot = (snapshot: AutoBackupSnapshot) => {
    const current = saveAutoBackup(items, orders, settings, 'manual')
    onRestore(snapshot.backup.items, snapshot.backup.orders, snapshot.backup.settings)
    setMessage(
      `Restored the snapshot from ${formatDate(snapshot.createdAt)}. ` +
      (current ? 'Your previous state was saved first.' : ''),
    )
    window.setTimeout(refreshSnapshots, 100)
  }

  const downloadSnapshot = (snapshot: AutoBackupSnapshot) => {
    const date = snapshot.createdAt.replace(/[:.]/g, '-')
    downloadJson(snapshot.backup, `JOS-One-auto-backup-${date}.json`)
  }

  const removeSnapshot = (id: string) => {
    deleteAutoBackup(id)
    refreshSnapshots()
  }

  const removeAllSnapshots = () => {
    if (!window.confirm('Delete all local automatic snapshots? Downloaded backup files will not be affected.')) return
    clearAutoBackups()
    refreshSnapshots()
    setMessage('Local automatic snapshots were deleted.')
  }

  const latest = snapshots[0]

  return (
    <main className="screen backup-screen">
      <section className="panel backup-hero">
        <p className="eyebrow">DATA PROTECTION</p>
        <h2>Automatic Backup Centre</h2>
        <p>
          JOS creates a local snapshot shortly after inventory, orders or settings change.
          It keeps the latest 10 different versions.
        </p>
        <div className="backup-health">
          <span className={latest ? 'backup-dot healthy' : 'backup-dot'} />
          <div>
            <strong>{latest ? 'Automatic protection active' : 'No automatic snapshot yet'}</strong>
            <small>{latest ? `Latest: ${formatDate(latest.createdAt)}` : 'Make a change or create one now.'}</small>
          </div>
        </div>
        <button type="button" className="secondary-action" onClick={createSnapshotNow}>
          Create snapshot now
        </button>
      </section>

      <section className="panel backup-card">
        <p className="eyebrow">LOCAL HISTORY</p>
        <h2>Rolling snapshots</h2>
        <p>
          Restore an earlier version after an accidental edit. These copies stay in this browser
          and are not a substitute for a downloaded backup.
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
                      {snapshot.reason === 'automatic' ? 'Automatic' : 'Manual'}
                    </small>
                  </div>
                </div>
                <div className="snapshot-actions">
                  <button type="button" onClick={() => restoreSnapshot(snapshot)}>Restore</button>
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
            <button type="button" className="danger-action" onClick={restore}>Restore this backup</button>
            <p>Your current state is saved as a local snapshot before restoration.</p>
          </div>
        )}
      </section>
    </main>
  )
}
