import { useMemo, useState } from 'react'
import type { JosSettings } from '../types/inventory.ts'

export function SourceCheck({ settings }: { settings: JosSettings }) {
  const [brand, setBrand] = useState('')
  const [purchase, setPurchase] = useState('')
  const [sale, setSale] = useState('')

  const result = useMemo(() => {
    const buy = Number(purchase) || 0
    const sell = Number(sale) || 0
    const profit = sell - buy
    const roi = buy > 0 ? (profit / buy) * 100 : 0
    const decision =
      buy <= 0 || sell <= 0 ? 'ENTER PRICES' :
      profit >= settings.minimumProfit && roi >= settings.targetRoi ? 'BUY' :
      profit >= settings.minimumProfit * 0.7 && roi >= settings.targetRoi * 0.7 ? 'CAUTION' :
      'PASS'
    return { profit, roi, decision }
  }, [purchase, sale, settings])

  return (
    <main className="screen source-screen">
      <section className="panel source-card">
        <p className="eyebrow">SOURCING DECISION</p>
        <h2>Should you buy it?</h2>
        <p>Use your current minimum profit and ROI rules for a quick first check.</p>
        <label>Brand<input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Brand" /></label>
        <label>Purchase price (£)<input inputMode="decimal" value={purchase} onChange={e => setPurchase(e.target.value)} placeholder="8.00" /></label>
        <label>Expected sale (£)<input inputMode="decimal" value={sale} onChange={e => setSale(e.target.value)} placeholder="25.00" /></label>
      </section>

      <section className={`panel decision-card decision-${result.decision.toLowerCase().replace(' ', '-')}`}>
        <p className="eyebrow">JOS DECISION</p>
        <h2>{result.decision}</h2>
        {brand && <p>{brand}</p>}
        <div className="decision-metrics">
          <div><span>Profit</span><strong>£{result.profit.toFixed(2)}</strong></div>
          <div><span>ROI</span><strong>{result.roi.toFixed(0)}%</strong></div>
        </div>
        <p className="decision-rule">Targets: £{settings.minimumProfit.toFixed(2)} profit and {settings.targetRoi}% ROI.</p>
      </section>
    </main>
  )
}
