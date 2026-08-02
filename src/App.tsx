import { useEffect, useState } from 'react'
import './styles.css'
import { Dashboard } from './components/Dashboard'
import { Inventory } from './components/Inventory'
import { BackupCenter } from './components/BackupCenter'
import { AddItem } from './components/AddItem'
import { SourceCheck } from './components/SourceCheck'
import { Orders } from './components/Orders'
import { FinanceCommandCentre } from './components/FinanceCommandCentre'
import { BusinessIntelligence } from './components/BusinessIntelligence'
import { PhotographyListingPipeline } from './components/PhotographyListingPipeline'
import { OperationsCommandCentre } from './components/OperationsCommandCentre'
import type { InventoryItem, JosSettings, OrderRecord, StockStatus } from './types/inventory'
import { saveAutoBackup } from './lib/autoBackup'

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
  finance: {
    openingCash: 0,
    emergencyReserve: 0,
    plannedSourcingBudget: 0,
    taxPlanningRate: 20,
    transactions: [],
  },
}

type Tab = 'home' | 'inventory' | 'add' | 'sourcecheck' | 'orders' | 'operations' | 'pipeline' | 'finance' | 'intelligence' | 'backup'

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveAutoBackup(items, orders, settings, 'automatic')
    }, 600)

    return () => window.clearTimeout(timer)
  }, [items, orders, settings])

  const updateItem = (updated: InventoryItem) => {
    setItems(current => current.map(item => (item.sku === updated.sku ? updated : item)))
  }

  const updateManyItems = (updatedItems: InventoryItem[]) => {
    const updates = new Map(updatedItems.map(item => [item.sku, item]))
    setItems(current => current.map(item => updates.get(item.sku) ?? item))
  }

  const deleteItem = (sku: string) => {
    setItems(current => current.filter(item => item.sku !== sku))
  }

  const addItem = (item: InventoryItem) => {
    setItems(current => [...current, item])
    setInventoryFilter(undefined)
    setTab('inventory')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const restoreBackup = (
    restoredItems: InventoryItem[],
    restoredOrders: OrderRecord[],
    restoredSettings: JosSettings,
  ) => {
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

  const titles: Record<Tab, string> = {
    home: 'Mission Control',
    inventory: 'Inventory Command Centre',
    add: 'Add Stock Item',
    sourcecheck: 'SourceCheck',
    orders: 'Orders',
    operations: 'Operations Command Centre',
    pipeline: 'Photography & Listing Pipeline',
    finance: 'Finance Command Centre',
    intelligence: 'Business Intelligence',
    backup: 'Backup Centre',
  }

  return (
    <div className="app-shell">
      <header className="app-bar">
        <img src={`${import.meta.env.BASE_URL}the-jae-edit-logo.png`} alt="The JAE Edit" />
        <div className="app-title">
          <p className="eyebrow">JOS ONE · VERSION 0.8.0</p>
          <h1>{titles[tab]}</h1>
          <p className="header-date">
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="header-shortcuts">
          <button
            type="button"
            className={`operations-shortcut ${tab === 'operations' ? 'active' : ''}`}
            onClick={() => changeTab('operations')}
            aria-label="Open Operations Command Centre"
          >
            ✓
          </button>
          <button
            type="button"
            className={`pipeline-shortcut ${tab === 'pipeline' ? 'active' : ''}`}
            onClick={() => changeTab('pipeline')}
            aria-label="Open Photography and Listing Pipeline"
          >
            ◉
          </button>
          <button
            type="button"
            className={`intelligence-shortcut ${tab === 'intelligence' ? 'active' : ''}`}
            onClick={() => changeTab('intelligence')}
            aria-label="Open Business Intelligence"
          >
            ◈
          </button>
          <button
            type="button"
            className={`finance-shortcut ${tab === 'finance' ? 'active' : ''}`}
            onClick={() => changeTab('finance')}
            aria-label="Open Finance Command Centre"
          >
            £
          </button>
          <button
            type="button"
            className={`backup-shortcut ${tab === 'backup' ? 'active' : ''}`}
            onClick={() => changeTab('backup')}
            aria-label="Open Backup Centre"
          >
            ⇅
          </button>
        </div>
      </header>

      {tab === 'home' && (
        <Dashboard
          items={items}
          orders={orders}
          settings={settings}
          onOpenInventory={openInventory}
          onOpenOrders={() => changeTab('orders')}
          onOpenAdd={() => changeTab('add')}
          onOpenSourceCheck={() => changeTab('sourcecheck')}
          onOpenFinance={() => changeTab('finance')}
        />
      )}
      {tab === 'inventory' && (
        <Inventory
          items={items}
          onUpdate={updateItem}
          onUpdateMany={updateManyItems}
          onDelete={deleteItem}
          initialStatus={inventoryFilter}
        />
      )}
      {tab === 'add' && <AddItem items={items} settings={settings} onSave={addItem} />}
      {tab === 'sourcecheck' && <SourceCheck settings={settings} />}
      {tab === 'orders' && <Orders orders={orders} />}
      {tab === 'operations' && (
        <OperationsCommandCentre
          items={items}
          orders={orders}
          onUpdate={updateItem}
          onOpenInventory={openInventory}
          onOpenPipeline={() => changeTab('pipeline')}
          onOpenOrders={() => changeTab('orders')}
          onOpenFinance={() => changeTab('finance')}
          onOpenSourceCheck={() => changeTab('sourcecheck')}
        />
      )}
      {tab === 'pipeline' && (
        <PhotographyListingPipeline
          items={items}
          onUpdate={updateItem}
          onUpdateMany={updateManyItems}
        />
      )}
      {tab === 'finance' && (
        <FinanceCommandCentre
          items={items}
          finance={settings.finance}
          onChange={finance => setSettings(current => ({ ...current, finance }))}
        />
      )}
      {tab === 'intelligence' && (
        <BusinessIntelligence
          items={items}
          finance={settings.finance}
          onOpenInventory={openInventory}
          onOpenFinance={() => changeTab('finance')}
          onOpenSourceCheck={() => changeTab('sourcecheck')}
          onOpenOrders={() => changeTab('orders')}
        />
      )}
      {tab === 'backup' && (
        <BackupCenter
          items={items}
          orders={orders}
          settings={settings}
          onRestore={restoreBackup}
        />
      )}

      <nav className="bottom-nav five-tabs" aria-label="Main navigation">
        <button type="button" className={tab === 'home' ? 'active' : ''} onClick={() => changeTab('home')}>
          <span aria-hidden="true">⌂</span><small>Home</small>
        </button>
        <button type="button" className={tab === 'inventory' ? 'active' : ''} onClick={() => openInventory()}>
          <span aria-hidden="true">▤</span><small>Inventory</small>
        </button>
        <button type="button" className={tab === 'add' ? 'active' : ''} onClick={() => changeTab('add')}>
          <span aria-hidden="true">＋</span><small>Add</small>
        </button>
        <button type="button" className={tab === 'sourcecheck' ? 'active' : ''} onClick={() => changeTab('sourcecheck')}>
          <span aria-hidden="true">⌕</span><small>SourceCheck</small>
        </button>
        <button type="button" className={tab === 'orders' ? 'active' : ''} onClick={() => changeTab('orders')}>
          <span aria-hidden="true">▣</span><small>Orders</small>
        </button>
      </nav>
    </div>
  )
}
