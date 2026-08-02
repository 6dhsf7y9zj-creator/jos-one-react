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
import { CeoReviewCentre } from './components/CeoReviewCentre'
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

type Tab = 'home' | 'review' | 'inventory' | 'add' | 'sourcecheck' | 'orders' | 'operations' | 'pipeline' | 'finance' | 'intelligence' | 'backup'

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
  const [modulesOpen, setModulesOpen] = useState(false)
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

  useEffect(() => {
    document.body.style.overflow = modulesOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [modulesOpen])

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
    setModulesOpen(false)
    setTab(nextTab)
    if (nextTab !== 'inventory') setInventoryFilter(undefined)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const titles: Record<Tab, string> = {
    home: 'Mission Control',
    review: 'CEO Review Centre',
    inventory: 'Inventory Command Centre',
    add: 'Add Stock Item',
    sourcecheck: 'SourceCheck',
    orders: 'Customer & Orders Command Centre',
    operations: 'Operations Command Centre',
    pipeline: 'Photography & Listing Pipeline',
    finance: 'Finance Command Centre',
    intelligence: 'Business Intelligence',
    backup: 'Backup Centre',
  }

  return (
    <div className="app-shell">
      <header className="jos-universal-header">
        <div className="jos-header-identity">
          <img src={`${import.meta.env.BASE_URL}the-jae-edit-logo.png`} alt="The JAE Edit" />
          <div className="app-title">
            <p className="eyebrow">JOS ONE · VERSION 1.2.0</p>
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
        </div>
      </header>

      {tab === 'review' && (
        <CeoReviewCentre
          items={items}
          orders={orders}
          settings={settings}
          onOpenInventory={openInventory}
          onOpenOrders={() => changeTab('orders')}
          onOpenPipeline={() => changeTab('pipeline')}
          onOpenFinance={() => changeTab('finance')}
          onOpenIntelligence={() => changeTab('intelligence')}
          onOpenBackup={() => changeTab('backup')}
          onOpenAdd={() => changeTab('add')}
          onOpenSourceCheck={() => changeTab('sourcecheck')}
        />
      )}

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
      {tab === 'orders' && (
        <Orders
          orders={orders}
          items={items}
          onChange={setOrders}
          onUpdateItem={updateItem}
        />
      )}
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

      <button
        type="button"
        className={`jos-quick-add ${tab === 'add' ? 'active' : ''}`}
        onClick={() => changeTab('add')}
        aria-label="Add stock item"
      >
        <span aria-hidden="true">＋</span>
        <small>Add Stock</small>
      </button>

      <nav className="bottom-nav jos-primary-nav" aria-label="Primary navigation">
        <button type="button" className={tab === 'home' ? 'active' : ''} onClick={() => changeTab('home')}>
          <span aria-hidden="true">⌂</span><small>Home</small>
        </button>
        <button type="button" className={tab === 'inventory' ? 'active' : ''} onClick={() => openInventory()}>
          <span aria-hidden="true">▤</span><small>Inventory</small>
        </button>
        <button type="button" className={tab === 'operations' ? 'active' : ''} onClick={() => changeTab('operations')}>
          <span aria-hidden="true">✓</span><small>Operations</small>
        </button>
        <button type="button" className={tab === 'finance' ? 'active' : ''} onClick={() => changeTab('finance')}>
          <span aria-hidden="true">£</span><small>Finance</small>
        </button>
        <button
          type="button"
          className={!['home', 'inventory', 'operations', 'finance', 'add'].includes(tab) || modulesOpen ? 'active' : ''}
          onClick={() => setModulesOpen(true)}
          aria-expanded={modulesOpen}
          aria-controls="jos-module-panel"
        >
          <span aria-hidden="true">☰</span><small>Modules</small>
        </button>
      </nav>

      {modulesOpen && (
        <div className="jos-module-overlay" role="presentation" onClick={() => setModulesOpen(false)}>
          <section
            id="jos-module-panel"
            className="jos-module-panel"
            role="dialog"
            aria-modal="true"
            aria-label="JOS modules"
            onClick={event => event.stopPropagation()}
          >
            <div className="jos-module-panel-handle" aria-hidden="true" />
            <div className="jos-module-panel-header">
              <div>
                <p className="eyebrow">JOS ONE MODULES</p>
                <h2>Choose a command centre</h2>
              </div>
              <button type="button" onClick={() => setModulesOpen(false)} aria-label="Close modules">×</button>
            </div>

            <div className="jos-module-grid">
              <button type="button" onClick={() => changeTab('review')}>
                <span>◎</span><strong>CEO Review</strong><small>Executive briefing and priorities</small>
              </button>
              <button type="button" onClick={() => changeTab('orders')}>
                <span>▣</span><strong>Customers & Orders</strong><small>Sales, buyers and dispatch</small>
              </button>
              <button type="button" onClick={() => changeTab('pipeline')}>
                <span>◉</span><strong>Listing Pipeline</strong><small>Photography through live listing</small>
              </button>
              <button type="button" onClick={() => changeTab('intelligence')}>
                <span>◈</span><strong>Business Intelligence</strong><small>Evidence, brands and decisions</small>
              </button>
              <button type="button" onClick={() => changeTab('sourcecheck')}>
                <span>⌕</span><strong>SourceCheck</strong><small>Assess potential stock purchases</small>
              </button>
              <button type="button" onClick={() => changeTab('backup')}>
                <span>⇅</span><strong>Backup Centre</strong><small>Protect and restore business data</small>
              </button>
              <button type="button" onClick={() => changeTab('add')}>
                <span>＋</span><strong>Add Stock</strong><small>Create a new inventory record</small>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
