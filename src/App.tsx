import { useEffect, useState } from 'react'
import './styles.css'
import { Dashboard } from './components/Dashboard.tsx'
import { Inventory } from './components/Inventory.tsx'
import { BackupCenter } from './components/BackupCenter.tsx'
import { AddItem } from './components/AddItem.tsx'
import { SourceCheck } from './components/SourceCheck.tsx'
import { Orders } from './components/Orders.tsx'
import { FinanceCommandCentre } from './components/FinanceCommandCentre.tsx'
import { BusinessIntelligence } from './components/BusinessIntelligence.tsx'
import { PhotographyListingPipeline } from './components/PhotographyListingPipeline.tsx'
import { OperationsCommandCentre } from './components/OperationsCommandCentre.tsx'
import { CeoReviewCentre } from './components/CeoReviewCentre.tsx'
import { InventoryIntelligenceEngine } from './components/InventoryIntelligenceEngine.tsx'
import { BrandPerformanceCentre } from './components/BrandPerformanceCentre.tsx'
import { CeoRecommendationCentre } from './components/CeoRecommendationCentre.tsx'
import { BusinessForecastingCentre } from './components/BusinessForecastingCentre.tsx'
import { AutomationCentre } from './components/AutomationCentre.tsx'
import { LaunchCommandCentre } from './components/LaunchCommandCentre.tsx'
import { InventoryEditCentre } from './components/InventoryEditCentre.tsx'
import { SalesProfitPlanningCentre } from './components/SalesProfitPlanningCentre.tsx'
import type { InventoryItem, JosSettings, OrderRecord, StockStatus } from './types/inventory.ts'
import { saveAutoBackup } from './lib/autoBackup.ts'
import { createDefaultAutomationSettings } from './lib/automationCentre.ts'
import { createDefaultLaunchCommandSettings } from './lib/launchCommand.ts'
import { defaultSalesPlanningSettings } from './lib/salesProfitPlanning.ts'
import { CoreProvider } from './core/CoreProvider.tsx'
import { deleteInventoryThroughCore, saveInventoryThroughCore } from './core/JOSCore.ts'

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
  monthlyProfitTarget: 5000,
  automation: createDefaultAutomationSettings(),
  launchCommand: createDefaultLaunchCommandSettings(),
  salesPlanning: defaultSalesPlanningSettings,
  finance: {
    openingCash: 0,
    emergencyReserve: 0,
    plannedSourcingBudget: 0,
    taxPlanningRate: 20,
    transactions: [],
  },
}

type Tab = 'home' | 'sales-planning' | 'review' | 'recommendations' | 'forecasting' | 'automation' | 'launch-command' | 'inventory' | 'inventory-edit' | 'inventory-intelligence' | 'brand-performance' | 'add' | 'sourcecheck' | 'orders' | 'operations' | 'pipeline' | 'finance' | 'intelligence' | 'backup'

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
  const [editingSku, setEditingSku] = useState<string | undefined>()
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
    const result = saveInventoryThroughCore(items, orders, settings, updated.sku, updated)
    setItems(result.items)
    setOrders(result.orders)
    setSettings(result.settings)
  }

  const saveEditedItem = (originalSku: string, updated: InventoryItem) => {
    const result = saveInventoryThroughCore(items, orders, settings, originalSku, updated)
    setItems(result.items)
    setOrders(result.orders)
    setSettings(result.settings)
    setEditingSku(undefined)
    setInventoryFilter(undefined)
    setTab('inventory')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openInventoryEdit = (sku: string) => {
    setEditingSku(sku)
    setModulesOpen(false)
    setTab('inventory-edit')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closeInventoryEdit = () => {
    setEditingSku(undefined)
    setTab('inventory')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updateManyItems = (updatedItems: InventoryItem[]) => {
    const updates = new Map(updatedItems.map(item => [item.sku, item]))
    setItems(current => current.map(item => updates.get(item.sku) ?? item))
  }

  const deleteItem = (sku: string) => {
    setItems(current => deleteInventoryThroughCore(current, sku))
    if (editingSku === sku) {
      setEditingSku(undefined)
      setTab('inventory')
    }
  }

  const addItem = (item: InventoryItem) => {
    const result = saveInventoryThroughCore(items, orders, settings, undefined, item)
    setItems(result.items)
    setOrders(result.orders)
    setSettings(result.settings)
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
    if (nextTab !== 'inventory-edit') setEditingSku(undefined)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const titles: Record<Tab, string> = {
    home: 'Mission Control',
    'sales-planning': 'Sales & Profit Planning Engine',
    review: 'CEO Review Centre',
    recommendations: 'CEO Recommendation Engine',
    forecasting: 'Business Forecasting Engine',
    automation: 'Automation Centre',
    'launch-command': 'January 2027 Launch Command Centre',
    inventory: 'Inventory Command Centre',
    'inventory-edit': 'Inventory Edit Centre',
    'inventory-intelligence': 'Inventory Intelligence Engine',
    'brand-performance': 'Brand Performance Centre',
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
    <CoreProvider items={items} orders={orders} settings={settings}>
    <div className="app-shell">
      <header className="jos-universal-header">
        <div className="jos-header-identity">
          <img src={`${import.meta.env.BASE_URL}the-jae-edit-logo.png`} alt="The JAE Edit" />
          <div className="app-title">
            <p className="eyebrow">JOS ONE · VERSION 3.1.0 SPRINT 1</p>
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
          onOpenRecommendations={() => changeTab('recommendations')}
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
          onOpenBrandPerformance={() => changeTab('brand-performance')}
          onOpenRecommendations={() => changeTab('recommendations')}
          onOpenForecasting={() => changeTab('forecasting')}
          onOpenAutomation={() => changeTab('automation')}
          onOpenLaunchCommand={() => changeTab('launch-command')}
          onOpenSalesPlanning={() => changeTab('sales-planning')}
        />
      )}
      {tab === 'sales-planning' && (
        <SalesProfitPlanningCentre
          items={items}
          orders={orders}
          settings={settings}
          onChangePlanning={salesPlanning => setSettings(current => ({ ...current, salesPlanning }))}
          onChangeTarget={monthlyProfitTarget => setSettings(current => ({ ...current, monthlyProfitTarget }))}
          onOpenOrders={() => changeTab('orders')}
          onOpenPipeline={() => changeTab('pipeline')}
          onOpenInventory={() => openInventory()}
          onOpenSourceCheck={() => changeTab('sourcecheck')}
          onOpenFinance={() => changeTab('finance')}
        />
      )}
      {tab === 'recommendations' && (
        <CeoRecommendationCentre
          items={items}
          orders={orders}
          settings={settings}
          onOpenInventory={openInventory}
          onOpenOrders={() => changeTab('orders')}
          onOpenPipeline={() => changeTab('pipeline')}
          onOpenFinance={() => changeTab('finance')}
          onOpenBrandPerformance={() => changeTab('brand-performance')}
          onOpenInventoryIntelligence={() => changeTab('inventory-intelligence')}
          onOpenSourceCheck={() => changeTab('sourcecheck')}
          onOpenOperations={() => changeTab('operations')}
        />
      )}
      {tab === 'forecasting' && (
        <BusinessForecastingCentre
          items={items}
          orders={orders}
          settings={settings}
          onChangeTarget={monthlyProfitTarget =>
            setSettings(current => ({ ...current, monthlyProfitTarget }))
          }
          onOpenFinance={() => changeTab('finance')}
          onOpenInventory={() => openInventory()}
          onOpenPipeline={() => changeTab('pipeline')}
          onOpenRecommendations={() => changeTab('recommendations')}
        />
      )}
      {tab === 'automation' && (
        <AutomationCentre
          items={items}
          orders={orders}
          settings={settings}
          onChangeAutomation={automation =>
            setSettings(current => ({ ...current, automation }))
          }
          onOpenRecommendations={() => changeTab('recommendations')}
          onOpenBackup={() => changeTab('backup')}
          onOpenInventoryIntelligence={() => changeTab('inventory-intelligence')}
          onOpenFinance={() => changeTab('finance')}
          onOpenLaunchCommand={() => changeTab('launch-command')}
        />
      )}
      {tab === 'launch-command' && (
        <LaunchCommandCentre
          items={items}
          orders={orders}
          settings={settings}
          onChangeLaunchCommand={launchCommand =>
            setSettings(current => ({ ...current, launchCommand }))
          }
          onChangeAutomation={automation =>
            setSettings(current => ({ ...current, automation }))
          }
          onOpenInventory={() => openInventory()}
          onOpenPipeline={() => changeTab('pipeline')}
          onOpenSourceCheck={() => changeTab('sourcecheck')}
          onOpenFinance={() => changeTab('finance')}
          onOpenAutomation={() => changeTab('automation')}
          onOpenBackup={() => changeTab('backup')}
        />
      )}
      {tab === 'inventory' && (
        <Inventory
          items={items}
          onUpdate={updateItem}
          onUpdateMany={updateManyItems}
          onEdit={openInventoryEdit}
          initialStatus={inventoryFilter}
        />
      )}
      {tab === 'inventory-edit' && editingSku && (() => {
        const editingItem = items.find(item => item.sku === editingSku)
        return editingItem ? (
          <InventoryEditCentre
            item={editingItem}
            items={items}
            settings={settings}
            onSave={saveEditedItem}
            onDelete={deleteItem}
            onCancel={closeInventoryEdit}
            onMove={openInventoryEdit}
          />
        ) : (
          <main className="screen panel">
            <p>The selected inventory item could not be found.</p>
            <button type="button" className="primary-action" onClick={closeInventoryEdit}>Return to Inventory</button>
          </main>
        )
      })()}
      {tab === 'inventory-intelligence' && (
        <InventoryIntelligenceEngine
          items={items}
          finance={settings.finance}
          onUpdateMany={updateManyItems}
          onOpenInventory={openInventory}
          onOpenPipeline={() => changeTab('pipeline')}
          onOpenOrders={() => changeTab('orders')}
          onOpenFinance={() => changeTab('finance')}
        />
      )}
      {tab === 'brand-performance' && (
        <BrandPerformanceCentre
          items={items}
          finance={settings.finance}
          targets={{
            targetRoi: settings.targetRoi,
            minimumProfit: settings.minimumProfit,
          }}
          onOpenInventory={() => openInventory()}
          onOpenFinance={() => changeTab('finance')}
          onOpenSourceCheck={() => changeTab('sourcecheck')}
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
          onOpenForecasting={() => changeTab('forecasting')}
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

      {tab !== 'inventory-edit' && <button
        type="button"
        className={`jos-quick-add ${tab === 'add' ? 'active' : ''}`}
        onClick={() => changeTab('add')}
        aria-label="Add stock item"
      >
        <span aria-hidden="true">＋</span>
        <small>Add Stock</small>
      </button>}

      {tab !== 'inventory-edit' && <nav className="bottom-nav jos-primary-nav" aria-label="Primary navigation">
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
      </nav>}

      {modulesOpen && tab !== 'inventory-edit' && (
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
              <button type="button" onClick={() => changeTab('recommendations')}>
                <span>⚡</span><strong>CEO Recommendations</strong><small>Ranked daily actions and sourcing control</small>
              </button>
              <button type="button" onClick={() => changeTab('sales-planning')}>
                <span>£</span><strong>Sales & Profit Planning</strong><small>Targets, sales volume, stock needs and health scores</small>
              </button>
              <button type="button" onClick={() => changeTab('forecasting')}>
                <span>↗</span><strong>Business Forecasting</strong><small>Cash, profit, reserves and target outlook</small>
              </button>
              <button type="button" onClick={() => changeTab('automation')}>
                <span>⟳</span><strong>Automation Centre</strong><small>Recurring reviews, alerts and launch readiness</small>
              </button>
              <button type="button" onClick={() => changeTab('launch-command')}>
                <span>◫</span><strong>January 2027 Launch</strong><small>Stock, listings, marketing and launch-day control</small>
              </button>

              <button type="button" onClick={() => changeTab('inventory-intelligence')}>
                <span>◆</span><strong>Inventory Intelligence</strong><small>Stock health, grading and cash lock</small>
              </button>
              <button type="button" onClick={() => changeTab('brand-performance')}>
                <span>★</span><strong>Brand Performance</strong><small>ROI, speed, cash lock and buying guidance</small>
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
    </CoreProvider>
  )
}
