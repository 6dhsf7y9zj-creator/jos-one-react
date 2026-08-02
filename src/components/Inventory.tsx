import { useMemo, useState } from 'react';
import type { InventoryItem } from '../types/inventory';
import { expectedProfit, nextStatus } from '../lib/inventory';

export function Inventory({ items, onUpdate }: { items: InventoryItem[]; onUpdate: (item: InventoryItem) => void }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => items.filter(i => `${i.sku} ${i.brand} ${i.category} ${i.storageLocation}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  return <main className="screen">
    <input className="search" placeholder="Search SKU, brand or storage" value={query} onChange={e => setQuery(e.target.value)} />
    <div className="inventory-list">
      {filtered.map(item => <article className="item-card" key={item.sku}>
        <p className="eyebrow">{item.sku}</p>
        <h3>{item.brand} {item.category}</h3>
        <p>{item.description} · {item.size}</p>
        <div className="item-meta"><span>{item.status}</span><strong>£{expectedProfit(item).toFixed(2)} profit</strong></div>
        <button onClick={() => onUpdate({ ...item, status: nextStatus(item.status) })}>Move to {nextStatus(item.status)}</button>
      </article>)}
    </div>
  </main>;
}
