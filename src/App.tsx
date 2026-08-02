import { useEffect, useState } from 'react'
import './styles.css'
import { Dashboard } from './components/Dashboard'
import { Inventory } from './components/Inventory'
import type { InventoryItem, StockStatus } from './types/inventory'

const seed: InventoryItem[] = [
  {
    sku: 'JAE-0001',
    brand: 'Nike',
    category: 'Hoodie',
    description: 'White Nike Hoodie',
    size: 'M',
    condition: 'Satisfactory',
    status: 'Photographed',
    grade: 'C',
    purchasePrice: 9.97,
    expectedSalePrice: 21.93,
    storageLocation: 'TBC',
  },
  {
    sku: 'JAE-0002',
    brand: 'Tommy Hilfiger',
    category: 'Hoodie',
    description: 'Navy hoodie',
    size: 'S',
    condition: 'Good',
    status: 'Prep',
    grade: 'B',
    purchasePrice: 7.45,
    expectedSalePrice: 16.99,
    storageLocation: 'Box A1',
  },
]

type Tab = 'home' | 'inventory'

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [inventoryFilter, setInventoryFilter] = useState<StockStatus | undefined>()
  const [items, setItems] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('jos-one-react-items')
      return saved ? JSON.parse(saved) : seed
    } catch {
      return seed
    }
  })

  useEffect(() => {
    localStorage.setItem('jos-one-react-items', JSON.stringify(items))
  }, [items])

  const updateItem = (updated: InventoryItem) => {
    setItems(current => current.map(item => (item.sku === updated.sku ? updated : item)))
  }

  const openInventory = (status?: StockStatus) => {
    setInventoryFilter(status)
    setTab('inventory')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openHome = () => {
    setInventoryFilter(undefined)
    setTab('home')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app-shell">
      <header className="app-bar">
        <img
          src={`${import.meta.env.BASE_URL}the-jae-edit-logo.png`}
          alt="The JAE Edit"
        />
        <div>
          <p className="eyebrow">JOS ONE · BUILD 02.1</p>
          <h1>{tab === 'home' ? 'Mission Control' : 'Inventory Command Centre'}</h1>
          <p className="header-date">
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </header>

      {tab === 'home' ? (
        <Dashboard items={items} onOpenInventory={openInventory} />
      ) : (
        <Inventory
          items={items}
          onUpdate={updateItem}
          initialStatus={inventoryFilter}
        />
      )}

      <nav className="bottom-nav" aria-label="Main navigation">
        <button
          type="button"
          className={tab === 'home' ? 'active' : ''}
          onClick={openHome}
        >
          <span aria-hidden="true">⌂</span>
          <small>Mission</small>
        </button>
        <button
          type="button"
          className={tab === 'inventory' ? 'active' : ''}
          onClick={() => openInventory()}
        >
          <span aria-hidden="true">▤</span>
          <small>Inventory</small>
        </button>
      </nav>
    </div>
  )
}
