import { useMemo, useState } from 'react'
import type { FinanceState, InventoryItem, StockStatus } from '../types/inventory'
import { calculateBusinessIntelligence, formatMoney, type IntelligenceInsight } from '../lib/intelligence'

type Props = {
  items: InventoryItem[]
  finance?: FinanceState
  onOpenInventory: (status?: StockStatus) => void
  onOpenFinance: () => void
  onOpenSourceCheck: () => void
  onOpenOrders: () => void
}

function insightAction(insight: IntelligenceInsight, props: Props): () => void {
  if (insight.destination === 'finance') return props.onOpenFinance
  if (insight.destination === 'sourcecheck') return props.onOpenSourceCheck
  if (insight.destination === 'orders') return props.onOpenOrders
  return () => props.onOpenInventory()
}

export function BusinessIntelligence(props: Props) {
  const intelligence = useMemo(() => calculateBusinessIntelligence(props.items, props.finance), [props.items, props.finance])
  const [brandView, setBrandView] = useState<'realised' | 'forecast'>('realised')
  const maxTrend = Math.max(1, ...intelligence.monthlyTrend.flatMap(month => [month.sales, month.expenses]))
  const realisedBrands = intelligence.brands.filter(brand => brand.realisedSales > 0)
  const rankedBrands = brandView === 'realised'
    ? [...realisedBrands].sort((a, b) => b.realisedProfit - a.realisedProfit)
    : [...intelligence.brands].sort((a, b) => b.forecastProfit - a.forecastProfit)

  return (
    <main className="screen bi-command-centre">
      <section className="bi-hero">
        <div>
          <p className="eyebrow">BUSINESS INTELLIGENCE</p>
          <h2>Turn records into decisions</h2>
          <p>JOS separates proven sales evidence from stock forecasts, then highlights the next decision that deserves attention.</p>
        </div>
        <div className={`bi-confidence confidence-${intelligence.dataQuality.score >= 85 ? 'strong' : intelligence.dataQuality.score >= 65 ? 'usable' : 'weak'}`}>
          <span>Decision data</span><strong>{intelligence.dataQuality.score}</strong><small>/100 confidence</small>
        </div>
      </section>

      <section className="bi-insight-grid">
        {intelligence.insights.map(insight => (
          <button type="button" className={`bi-insight tone-${insight.tone}`} key={insight.id} onClick={insightAction(insight, props)}>
            <span className="insight-tone-dot" />
            <span className="insight-copy"><strong>{insight.title}</strong><small>{insight.detail}</small><em>{insight.recommendation}</em></span>
            <b>›</b>
          </button>
        ))}
      </section>

      <section className="panel bi-ageing-panel">
        <div className="section-heading compact"><div><p className="eyebrow">STOCK AGEING</p><h2>Where cash is slowing down</h2></div><button type="button" className="text-button" onClick={() => props.onOpenInventory()}>Open inventory</button></div>
        <div className="ageing-buckets">
          <div className="age-young"><span>Under 30 days</span><strong>{intelligence.ageing.under30}</strong></div>
          <div className="age-watch"><span>30–59 days</span><strong>{intelligence.ageing.days30to59}</strong></div>
          <div className="age-warning"><span>60–89 days</span><strong>{intelligence.ageing.days60to89}</strong></div>
          <div className="age-urgent"><span>90+ days</span><strong>{intelligence.ageing.days90plus}</strong></div>
        </div>
        <div className="ageing-money"><div><span>Cost tied at 60+ days</span><strong>{formatMoney(intelligence.ageing.cost60plus)}</strong></div><div><span>Forecast profit at 60+ days</span><strong>{formatMoney(intelligence.ageing.forecastProfit60plus)}</strong></div></div>
        <p className="bi-truth">Age uses recorded date-listed/date-sourced fields or the stored days-in-stock value. Missing dates weaken the result.</p>
      </section>

      <section className="panel bi-pipeline-panel">
        <div className="section-heading compact"><div><p className="eyebrow">PIPELINE INTELLIGENCE</p><h2>What is blocking cash conversion</h2></div></div>
        <div className="pipeline-intelligence">
          <button type="button" onClick={() => props.onOpenInventory('Prep')}><span>Cost waiting in Prep</span><strong>{formatMoney(intelligence.pipeline.prepCost)}</strong></button>
          <button type="button" onClick={() => props.onOpenInventory('Photographed')}><span>Photographed sales value</span><strong>{formatMoney(intelligence.pipeline.photographedValue)}</strong></button>
          <button type="button" onClick={() => props.onOpenInventory('Live')}><span>Live sales value</span><strong>{formatMoney(intelligence.pipeline.liveValue)}</strong><small>{intelligence.pipeline.liveCount} live items</small></button>
          <div><span>Observed conversion evidence</span><strong>{intelligence.pipeline.conversionEvidence.toFixed(0)}%</strong><small>Linked sold records ÷ live + linked sold</small></div>
        </div>
        <p className="bi-truth">This conversion figure is evidence coverage, not a platform-wide sell-through rate. It improves only when sales are linked to SKUs.</p>
      </section>

      <section className="panel bi-trend-panel">
        <div className="section-heading compact"><div><p className="eyebrow">SIX-MONTH TREND</p><h2>Recorded sales and expenses</h2></div><button type="button" className="text-button" onClick={props.onOpenFinance}>Finance</button></div>
        <div className="bi-trend-chart">
          {intelligence.monthlyTrend.map(month => (
            <div className="trend-month" key={month.key}>
              <div className="trend-bars"><span className="sales-bar" style={{ height: `${Math.max(3, month.sales / maxTrend * 100)}%` }} /><span className="expense-bar" style={{ height: `${Math.max(3, month.expenses / maxTrend * 100)}%` }} /></div>
              <strong>{month.label}</strong><small>{formatMoney(month.profit)}</small>
            </div>
          ))}
        </div>
        <div className="trend-legend"><span><i className="legend-sales" /> Sales</span><span><i className="legend-expenses" /> Expenses</span></div>
      </section>

      <section className="panel bi-brand-panel">
        <div className="section-heading compact"><div><p className="eyebrow">BRAND INTELLIGENCE</p><h2>{brandView === 'realised' ? 'Recorded realised performance' : 'Current stock forecast'}</h2></div></div>
        <div className="brand-view-toggle"><button type="button" className={brandView === 'realised' ? 'active' : ''} onClick={() => setBrandView('realised')}>Realised</button><button type="button" className={brandView === 'forecast' ? 'active' : ''} onClick={() => setBrandView('forecast')}>Forecast</button></div>
        {rankedBrands.length === 0 ? <div className="bi-empty"><h3>No realised brand evidence yet</h3><p>Record sales in Finance and link them to inventory SKUs.</p></div> : <div className="bi-brand-list">{rankedBrands.slice(0, 8).map((brand, index) => (
          <article key={brand.brand}><span className="brand-rank">{index + 1}</span><div><strong>{brand.brand}</strong><small>{brandView === 'realised' ? `${brand.realisedSales} linked sales${typeof brand.averageDaysToSell === 'number' ? ` · ${brand.averageDaysToSell.toFixed(0)} avg days` : ' · days-to-sell unavailable'}` : `${brand.activeItems} active items · ${brand.averageForecastRoi.toFixed(0)}% avg ROI`}</small></div><b>{formatMoney(brandView === 'realised' ? brand.realisedProfit : brand.forecastProfit)}</b><em>{brand.dataConfidence}</em></article>
        ))}</div>}
        <p className="bi-truth">“Forecast-only” ranks unsold stock assumptions. “Limited” means fewer than five linked sales. Neither should be treated as a settled sourcing rule.</p>
      </section>

      <section className="panel bi-sourcing-panel">
        <div className="section-heading compact"><div><p className="eyebrow">SOURCING INTELLIGENCE</p><h2>Budget capacity, not a buying target</h2></div><button type="button" className="text-button" onClick={props.onOpenSourceCheck}>SourceCheck</button></div>
        <div className="sourcing-intelligence"><div><span>Average active item cost</span><strong>{formatMoney(intelligence.sourcing.averagePurchaseCost)}</strong></div><div><span>Budget supports roughly</span><strong>{intelligence.sourcing.affordableItems} items</strong></div></div>
        <div className="brand-guidance"><div><span>Evidence / forecast leaders</span><strong>{intelligence.sourcing.recommendedBrands.join(', ') || 'Not enough data'}</strong></div><div><span>Low forecast ROI watchlist</span><strong>{intelligence.sourcing.avoidBrands.join(', ') || 'None identified'}</strong></div></div>
        <p className="bi-truth">Available budget limits capacity. It does not prove that equivalent-quality stock is available or that it should all be spent.</p>
      </section>

      <section className="panel bi-data-panel">
        <div className="section-heading compact"><div><p className="eyebrow">DATA QUALITY</p><h2>What is weakening the intelligence</h2></div></div>
        <div className="data-quality-grid"><div><span>Sales linked to SKUs</span><strong>{intelligence.dataQuality.linkedSales}/{intelligence.dataQuality.totalSales}</strong></div><div><span>Inventory with dates</span><strong>{intelligence.dataQuality.inventoryWithDates}/{props.items.length}</strong></div><div><span>Missing storage</span><strong>{intelligence.dataQuality.missingStorage}</strong></div><div><span>Sold items missing actual price</span><strong>{intelligence.dataQuality.missingActualSalePrice}</strong></div></div>
        <p className="bi-truth">The sharp truth: sophisticated dashboards cannot repair incomplete records. Better data entry will improve JOS more than extra charts.</p>
      </section>
    </main>
  )
}
