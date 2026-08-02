import { useRef, useState } from 'react'
import type { InventoryItem, JosSettings, OrderRecord } from '../types/inventory'
import { createBackup, migrateBackup } from '../lib/backup'

type BackupCenterProps = {
  items: InventoryItem[]
  orders: OrderRecord[]
  settings: JosSettings
  onRestore: (items: InventoryItem[], orders: OrderRecord[], settings: JosSettings) => void
}

export function BackupCenter({ items, orders, settings, onRestore }: BackupCenterProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<ReturnType<typeof migrateBackup> | null>(null)

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
    onRestore(pending.items, pending.orders, pending.settings)
    setMessage(`Restored ${pending.items.length} inventory items successfully.`)
    setPending(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  const downloadBackup = () => {
    const backup = createBackup(items, orders, settings)
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `JOS-One-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    setMessage(`Backup exported with ${items.length} items.`)
  }

  return (
    <main className="screen backup-screen">
      <section className="panel backup-hero">
        <p className="eyebrow">DATA PROTECTION</p>
        <h2>Backup & Restore</h2>
        <p>Your JOS data is stored on this device. Export a backup before major updates and restore it here whenever needed.</p>
      </section>

      <section className="panel backup-card">
        <p className="eyebrow">RESTORE</p>
        <h2>Import a JOS backup</h2>
        <p>Select the JSON backup from the old JOS app. JOS checks the file before replacing your current records.</p>
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
            <p>This replaces the two sample records currently shown in the React app.</p>
          </div>
        )}
      </section>

      <section className="panel backup-card">
        <p className="eyebrow">EXPORT</p>
        <h2>Protect the current system</h2>
        <p>Download a fresh copy of your inventory, orders and settings.</p>
        <dl className="backup-summary">
          <div><dt>Inventory items</dt><dd>{items.length}</dd></div>
          <div><dt>Orders</dt><dd>{orders.length}</dd></div>
          <div><dt>Minimum profit</dt><dd>£{settings.minimumProfit.toFixed(2)}</dd></div>
        </dl>
        <button type="button" className="primary-action" onClick={downloadBackup}>Download backup</button>
      </section>
    </main>
  )
}
