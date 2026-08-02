import type { InventoryItem } from '../types/inventory';
import { expectedProfit } from '../lib/inventory';

export function Dashboard({ items }: { items: InventoryItem[] }) {
  const active = items.filter(i => !['Archived', 'Dispatched'].includes(i.status));
  const totalCost = active.reduce((sum, i) => sum + i.purchasePrice, 0);
  const profit = active.reduce((sum, i) => sum + expectedProfit(i), 0);
  const prep = items.filter(i => i.status === 'Prep').length;
  const photographed = items.filter(i => i.status === 'Photographed').length;
  const score = Math.max(0, 100 - prep * 2 - photographed);

  return <main className="screen">
    <section className="hero-card">
      <p className="eyebrow">GOOD EVENING, NICK</p>
      <div className="score-row"><strong>{score}/100</strong><img src="./the-jae-edit-logo.png" alt="The JAE Edit" /></div>
      <span className="health">● {score >= 75 ? 'Strong' : 'Needs attention'}</span>
    </section>

    <section className="mission-card">
      <p className="eyebrow light">CEO MODE · TWO-HOUR PLAN</p>
      <h2>{prep > 0 ? `Prepare ${Math.min(prep, 6)} stock items` : photographed > 0 ? `List ${Math.min(photographed, 6)} photographed items` : 'Review business performance'}</h2>
      <p>Highest-impact task based on your current workflow.</p>
      <button>Start First Task</button>
    </section>

    <section className="stats">
      <article><span>Inventory cost</span><strong>£{totalCost.toFixed(2)}</strong></article>
      <article><span>Active stock</span><strong>{active.length}</strong></article>
      <article><span>Expected profit</span><strong>£{profit.toFixed(2)}</strong></article>
    </section>

    <section className="panel">
      <p className="eyebrow">NEEDS ATTENTION</p>
      <div className="alert">• {prep} items awaiting preparation</div>
      <div className="alert">• {photographed} photographed but not live</div>
    </section>
  </main>;
}
