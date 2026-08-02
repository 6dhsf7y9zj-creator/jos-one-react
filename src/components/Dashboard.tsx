import type { InventoryItem, StockStatus } from '../types/inventory'
import { expectedProfit } from '../lib/inventory'

type DashboardProps = {
  items: InventoryItem[]
  onOpenInventory: (status?: StockStatus) => void
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function Dashboard({ items, onOpenInventory }: DashboardProps) {
  const active = items.filter(item => !['Archived', 'Dispatched'].includes(item.status))
  const inventoryCost = active.reduce((sum, item) => sum + item.purchasePrice, 0)
  const expectedSales = active.reduce((sum, item) => sum + item.expectedSalePrice, 0)
  const profit = active.reduce((sum, item) => sum + expectedProfit(item), 0)
  const prep = items.filter(item => item.status === 'Prep').length
  const photographed = items.filter(item => item.status === 'Photographed').length
  const sold = items.filter(item => item.status === 'Sold').length
  const live = items.filter(item => item.status === 'Live').length
  const missingStorage = active.filter(item => !item.storageLocation || item.storageLocation === 'TBC').length

  const score = Math.max(
    0,
    Math.min(100, 100 - prep * 2 - photographed - sold * 4 - missingStorage),
  )

  const mission = sold > 0
    ? {
        title: `Prepare ${sold} sold ${sold === 1 ? 'order' : 'orders'} for dispatch`,
        detail: 'Customer commitments come first. Complete these before other work.',
        button: 'Open sold stock',
        status: 'Sold' as StockStatus,
        minutes: sold * 8,
      }
    : prep > 0
      ? {
          title: `Prepare ${Math.min(prep, 6)} stock ${prep === 1 ? 'item' : 'items'}`,
          detail: 'Move sourced stock into the photography queue and unlock its selling potential.',
          button: 'Start preparation',
          status: 'Prep' as StockStatus,
          minutes: Math.min(prep, 6) * 10,
        }
      : photographed > 0
        ? {
            title: `List ${Math.min(photographed, 6)} photographed ${photographed === 1 ? 'item' : 'items'}`,
            detail: 'These items are closest to becoming live stock and generating sales.',
            button: 'Open listing queue',
            status: 'Photographed' as StockStatus,
            minutes: Math.min(photographed, 6) * 12,
          }
        : {
            title: 'Review live inventory performance',
            detail: 'Your immediate workflow is clear. Review pricing and ageing stock next.',
            button: 'Open live inventory',
            status: 'Live' as StockStatus,
            minutes: 30,
          }

  const healthLabel = score >= 85 ? 'Strong' : score >= 65 ? 'Stable' : 'Needs attention'

  return (
    <main className="screen mission-control">
      <section className="hero-card">
        <div>
          <p className="eyebrow">MISSION CONTROL</p>
          <h2>{greeting()}, Nick</h2>
          <p className="hero-copy">Here is the clearest next move for The JAE Edit today.</p>
        </div>
        <div className="health-block" aria-label={`Business health ${score} out of 100`}>
          <strong>{score}</strong>
          <span>/100</span>
          <small>{healthLabel}</small>
        </div>
      </section>

      <section className="mission-card">
        <p className="eyebrow light">TODAY&apos;S HIGHEST-IMPACT MISSION</p>
        <h2>{mission.title}</h2>
        <p>{mission.detail}</p>
        <div className="mission-impact">
          <span>Estimated session</span>
          <strong>{mission.minutes} mins</strong>
        </div>
        <button type="button" onClick={() => onOpenInventory(mission.status)}>
          {mission.button}
        </button>
      </section>

      <section aria-labelledby="snapshot-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BUSINESS SNAPSHOT</p>
            <h2 id="snapshot-title">Know the position in seconds</h2>
          </div>
          <button className="text-button" type="button" onClick={() => onOpenInventory()}>
            View all stock
          </button>
        </div>

        <div className="stats stats-four">
          <button type="button" onClick={() => onOpenInventory()}>
            <span>Inventory cost</span>
            <strong>£{inventoryCost.toFixed(2)}</strong>
          </button>
          <button type="button" onClick={() => onOpenInventory()}>
            <span>Expected sales</span>
            <strong>£{expectedSales.toFixed(2)}</strong>
          </button>
          <button type="button" onClick={() => onOpenInventory()}>
            <span>Expected profit</span>
            <strong>£{profit.toFixed(2)}</strong>
          </button>
          <button type="button" onClick={() => onOpenInventory('Live')}>
            <span>Live stock</span>
            <strong>{live}</strong>
          </button>
        </div>
      </section>

      <section className="panel attention-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">NEEDS ATTENTION</p>
            <h2>Remove today&apos;s bottlenecks</h2>
          </div>
        </div>

        <button className="alert-row" type="button" onClick={() => onOpenInventory('Prep')}>
          <span className={prep > 0 ? 'alert-dot warning' : 'alert-dot good'} />
          <span><strong>{prep}</strong> awaiting preparation</span>
          <b>›</b>
        </button>
        <button className="alert-row" type="button" onClick={() => onOpenInventory('Photographed')}>
          <span className={photographed > 0 ? 'alert-dot warning' : 'alert-dot good'} />
          <span><strong>{photographed}</strong> photographed but not live</span>
          <b>›</b>
        </button>
        <button className="alert-row" type="button" onClick={() => onOpenInventory('Sold')}>
          <span className={sold > 0 ? 'alert-dot urgent' : 'alert-dot good'} />
          <span><strong>{sold}</strong> sold and awaiting dispatch</span>
          <b>›</b>
        </button>
        <button className="alert-row" type="button" onClick={() => onOpenInventory()}>
          <span className={missingStorage > 0 ? 'alert-dot warning' : 'alert-dot good'} />
          <span><strong>{missingStorage}</strong> missing a storage location</span>
          <b>›</b>
        </button>
      </section>

      <section className="quick-actions" aria-labelledby="quick-actions-title">
        <p className="eyebrow">QUICK ACTIONS</p>
        <h2 id="quick-actions-title">Move straight into the work</h2>
        <div>
          <button type="button" onClick={() => onOpenInventory('Prep')}>Preparation queue</button>
          <button type="button" onClick={() => onOpenInventory('Photographed')}>Listing queue</button>
          <button type="button" onClick={() => onOpenInventory('Sold')}>Sold orders</button>
          <button type="button" onClick={() => onOpenInventory()}>Search inventory</button>
        </div>
      </section>
    </main>
  )
}
