import { useEffect, useState } from 'react';
import './styles.css';
import { Dashboard } from './components/Dashboard';
import { Inventory } from './components/Inventory';
import type { InventoryItem } from './types/inventory';

const seed: InventoryItem[] = [
  { sku: 'JAE-0001', brand: 'Nike', category: 'Hoodie', description: 'White Nike Hoodie', size: 'M', condition: 'Satisfactory', status: 'Photographed', grade: 'C', purchasePrice: 9.97, expectedSalePrice: 21.93, storageLocation: 'TBC' },
  { sku: 'JAE-0002', brand: 'Tommy Hilfiger', category: 'Hoodie', description: 'Navy hoodie', size: 'S', condition: 'Good', status: 'Prep', grade: 'B', purchasePrice: 7.45, expectedSalePrice: 16.99, storageLocation: 'Box A1' }
];

export default function App() {
  const [tab, setTab] = useState<'home' | 'inventory'>('home');
  const [items, setItems] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('jos-one-react-items');
    return saved ? JSON.parse(saved) : seed;
  });
  useEffect(() => localStorage.setItem('jos-one-react-items', JSON.stringify(items)), [items]);
  const updateItem = (updated: InventoryItem) => setItems(current => current.map(i => i.sku === updated.sku ? updated : i));

  return <div className="app-shell">
    <header><img src="./the-jae-edit-logo.png" alt="The JAE Edit" /><div><p className="eyebrow">JOS ONE · REACT FOUNDATION 1.0</p><h1>{tab === 'home' ? 'CEO Dashboard' : 'Inventory Command Centre'}</h1><p>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div></header>
    {tab === 'home' ? <Dashboard items={items} /> : <Inventory items={items} onUpdate={updateItem} />}
    <nav><button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>⌂<span>Home</span></button><button className={tab === 'inventory' ? 'active' : ''} onClick={() => setTab('inventory')}>▤<span>Inventory</span></button></nav>
  </div>;
}
