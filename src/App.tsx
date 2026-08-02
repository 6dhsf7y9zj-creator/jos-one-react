import { useEffect, useState } from 'react'
import './styles.css'
import { Dashboard } from './components/Dashboard'
import { Inventory } from './components/Inventory'
import { BackupCenter } from './components/BackupCenter'
import type { InventoryItem, JosSettings, OrderRecord, StockStatus } from './types/inventory'

const seed: InventoryItem[] = [
  {
    sku: 'JAE-0001', brand: 'Nike', category: 'Hoodie', description: 'White Nike Hoodie', size: 'M',
    condition: 'Satisfactory', status: 'Photographed', grade: 'C', purchasePrice: 9.97,
    expectedSalePrice: 21.93, storageLocation: 'TBC',
  },
  {
    sku: 'JAE-0002', brand: 'Tommy Hilfiger', category: 'Hoodie', description: 'Navy hoodie', size: 'S',
    condition: 'Good', status: 'Prep', grade: 'B', purchasePrice: 7.45,
    expectedSalePrice: 16.99, storageLocation: 'Box A1',
  },
]

const defaultSettings: JosSettings = {
  minimumProfit: 15,
  targetRoi: 150,
  storageLocations: ['Box A1', 'Box A2', 'Box B1', 'Rail 1', 'Shelf 1'],
}

type Tab = 'home' | 'inventory' | 'backup'

function readStored<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : fallback
  } catch {
    return fallback
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [inventoryFilter, setInventoryFilter] = useState<StockStatus | undefined>()
  const [items, setItems] = useState<InventoryItem[]>(() => readStored('jos-one-react-items', seed))
  const [orders, setOrders] = useState<OrderRecord[]>(() => readStored('jos-one-react-orders', []))
  const [settings, setSettings] = useState<JosSettings>(() => readStored('jos-one-react-settings', defaultSettings))

  useEffect(() => localStorage.setItem('jos-one-react-items', JSON.stringify(items)), [items])
  useEffect(() => localStorage.setItem('jos-one-react-orders', JSON.stringify(orders)), [orders])
  useEffect(() => localStorage.setItem('jos-one-react-settings', JSON.stringify(settings)), [settings])

  const updateItem = (updated: InventoryItem) => {
    setItems(current => current.map(item => (item.sku === updated.sku ? updated : item)))
  }

  const restoreBackup = (restoredItems: InventoryItem[], restoredOrders: OrderRecord[], restoredSettings: JosSettings) => {
    setItems(restoredItems)
    setOrders(restoredOrders)
    setSettings(restoredSettings)
    setInventoryFilter(undefined)
  }

  const openInventory = (status?: StockStatus) => {
    setInventoryFilter(status)
    setTab('inventory')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const changeTab = (nextTab: Tab) => {
    setTab(nextTab)
    if (nextTab !== 'inventory') setInventoryFilter(undefined)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const title = tab === 'home' ? 'Mission Control' : tab === 'inventory' ? 'Inventory Command Centre' : 'Backup Centre'

  return (
    <div className="app-shell">
      <header className="app-bar">
        <img src={`${import.meta.env.BASE_URL}the-jae-edit-logo.png`} alt="The JAE Edit" />
        <div>
          <p className="eyebrow">JOS ONE · BUILD 02.2</p>
          <h1>{title}</h1>
          <p className="header-date">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </header>

      {tab === 'home' && <Dashboard items={items} onOpenInventory={openInventory} />}
      {tab === 'inventory' && <Inventory items={items} onUpdate={updateItem} initialStatus={inventoryFilter} />}
      {tab === 'backup' && <BackupCenter items={items} orders={orders} settings={settings} onRestore={restoreBackup} />}

      <nav className="bottom-nav" aria-label="Main navigation">
        <button type="button" className={tab === 'home' ? 'active' : ''} onClick={() => changeTab('home')}>
          <span aria-hidden="true">⌂</span><small>Mission</small>
        </button>
        <button type="button" className={tab === 'inventory' ? 'active' : ''} onClick={() => openInventory()}>
          <span aria-hidden="true">▤</span><small>Inventory</small>
        </button>
        <button type="button" className={tab === 'backup' ? 'active' : ''} onClick={() => changeTab('backup')}>
          <span aria-hidden="true">⇅</span><small>Backup</small>
        </button>
      </nav>
    </div>
  )
}
