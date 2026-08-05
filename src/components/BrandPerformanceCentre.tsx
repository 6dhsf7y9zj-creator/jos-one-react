import { useMemo, useState } from 'react'
import type { FinanceState, InventoryItem } from '../types/inventory.ts'
import {
  calculateBrandPerformance,
  type BrandEvidence,
  type BrandPerformance,
  type BrandPerformanceTargets,
  type BrandRecommendation,
} from '../lib/brandPerformance.ts'
import { formatFinanceMoney } from '../lib/finance.ts'
import { EmptyState, JosButton, KpiCard, NoticeCard, SectionHeader } from '../ui/index.ts'

type Props = {
  items: InventoryItem[]
  finance?: FinanceState
  targets: BrandPerformanceTargets
  onOpenInventory: () => void
  onOpenFinance: () => void
  onOpenSourceCheck: () => void
}

type View = 'leaderboard' | 'recommendations' | 'cash' | 'evidence'
type Sort =
  | 'score'
  | 'realised-profit'
  | 'forecast-profit'
  | 'cash'
  | 'roi'
  | 'speed'

function recommendationTone(
  recommendation: BrandRecommendation,
): 'positive' | 'warning' | 'urgent' | 'information' {
  if (recommendation === 'Buy More') return 'positive'
  if (recommendation === 'Reduce Buying') return 'warning'
  if (recommendation === 'Exit Brand') return 'urgent'
  return 'information'
}

function evidenceLabel(evidence: BrandEvidence): string {
  return evidence.replace('-', ' ')
}

function sortBrands(brands: BrandPerformance[], sort: Sort): BrandPerformance[] {
  return [...brands].sort((a, b) => {
    if (sort === 'realised-profit') return b.realisedProfit - a.realisedProfit
    if (sort === 'forecast-profit') return b.forecastProfit - a.forecastProfit
    if (sort === 'cash') return b.activeCost - a.activeCost
    if (sort === 'roi') return (b.realisedRoi ?? b.averageForecastRoi) - (a.realisedRoi ?? a.averageForecastRoi)
    if (sort === 'speed') {
      return (a.averageDaysToSell ?? Infinity) - (b.averageDaysToSell ?? Infinity)
    }
    return b.cashEfficiencyScore - a.cashEfficiencyScore
  })
}

export function BrandPerformanceCentre({
  items,
  finance,
  targets,
  onOpenInventory,
  onOpenFinance,
  onOpenSourceCheck,
}: Props) {
  const report = useMemo(
    () => calculateBrandPerformance(items, finance, targets),
    [items, finance, targets],
  )
  const [view, setView] = useState<View>('leaderboard')
  const [sort, setSort] = useState<Sort>('score')
  const [query, setQuery] = useState('')
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)

  const filtered = sortBrands(
    report.brands.filter(brand =>
      brand.brand.toLowerCase().includes(query.trim().toLowerCase()),
    ),
    sort,
  )
  const selected = report.brands.find(brand => brand.brand === selectedBrand)

  const views: Array<{ key: View; label: string }> = [
    { key: 'leaderboard', label: 'Leaderboard' },
    { key: 'recommendations', label: 'Recommendations' },
    { key: 'cash', label: 'Cash lock' },
    { key: 'evidence', label: 'Evidence' },
  ]

  return (
    <main className="screen brand-performance-centre">
      <section className="bp-hero">
        <div>
          <p className="eyebrow">BRAND PERFORMANCE ENGINE</p>
          <h2>Buy brands from evidence, not reputation alone</h2>
          <p>
            Linked sales, returns, selling speed, sell-through and cash ageing are combined
            into controlled brand recommendations.
          </p>
        </div>
        <div className={`bp-score score-${report.portfolioScore >= 75 ? 'strong' : report.portfolioScore >= 55 ? 'stable' : 'risk'}`}>
          <span>Portfolio score</span>
          <strong>{report.portfolioScore}</strong>
          <small>/100 · {report.brandsWithRealisedSales} brands with sales evidence</small>
        </div>
      </section>

      {report.dataQuality.unlinkedSales > 0 && (
        <NoticeCard title={`${report.dataQuality.unlinkedSales} finance sales are not linked to stock`} tone="warning">
          Link sales to SKUs before treating brand results as complete.
        </NoticeCard>
      )}

      <section className="jos-kpi-grid">
        <KpiCard
          label="Active brands"
          value={report.totalBrands}
          detail={`${report.brandsWithRealisedSales} with realised evidence`}
          tone="information"
        />
        <KpiCard
          label="Cash tied by brand"
          value={formatFinanceMoney(report.activeBrandCash)}
          detail={`${formatFinanceMoney(report.aged90BrandCash)} aged 90+ days`}
          tone={report.aged90BrandCash > 0 ? 'warning' : 'positive'}
          onClick={onOpenInventory}
        />
        <KpiCard
          label="Realised brand profit"
          value={formatFinanceMoney(report.realisedProfit)}
          detail={`${formatFinanceMoney(report.realisedRevenue)} linked sales revenue`}
          tone={report.realisedProfit >= 0 ? 'positive' : 'urgent'}
          onClick={onOpenFinance}
        />
        <KpiCard
          label="Buying changes"
          value={report.recommendationCounts['Buy More'] + report.recommendationCounts['Reduce Buying'] + report.recommendationCounts['Exit Brand']}
          detail={`${report.recommendationCounts['Buy More']} buy more · ${report.recommendationCounts['Reduce Buying'] + report.recommendationCounts['Exit Brand']} reduce/exit`}
          tone={report.recommendationCounts['Reduce Buying'] + report.recommendationCounts['Exit Brand'] > 0 ? 'warning' : 'positive'}
          onClick={() => setView('recommendations')}
        />
      </section>

      <section className="bp-controls panel">
        <input
          className="search"
          value={query}
          onChange={(event: { target: { value: string } }) => setQuery(event.target.value)}
          placeholder="Search a brand"
        />
        <select value={sort} onChange={(event: { target: { value: string } }) => setSort(event.target.value as Sort)} aria-label="Sort brands">
          <option value="score">Cash efficiency score</option>
          <option value="realised-profit">Realised profit</option>
          <option value="forecast-profit">Forecast profit</option>
          <option value="cash">Cash tied up</option>
          <option value="roi">ROI</option>
          <option value="speed">Fastest selling</option>
        </select>
        <div className="bp-view-tabs">
          {views.map(option => (
            <button
              type="button"
              className={view === option.key ? 'active' : ''}
              key={option.key}
              onClick={() => setView(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {view === 'leaderboard' && (
        <section className="panel">
          <SectionHeader
            eyebrow="BRAND LEADERBOARD"
            title="Evidence-weighted performance"
            description="Forecast figures remain visible, but realised metrics receive priority when linked sales exist."
          />
          {filtered.length === 0 ? (
            <EmptyState title="No matching brand" description="Clear the search to show all brands." />
          ) : (
            <div className="bp-brand-list">
              {filtered.map((brand, index) => (
                <article className={`bp-brand-card recommendation-${brand.recommendation.toLowerCase().replaceAll(' ', '-')}`} key={brand.brand}>
                  <button type="button" className="bp-brand-summary" onClick={() => setSelectedBrand(selectedBrand === brand.brand ? null : brand.brand)}>
                    <span className="bp-rank">{index + 1}</span>
                    <span className="bp-brand-copy">
                      <strong>{brand.brand}</strong>
                      <small>{brand.activeItems} active · {brand.completedSales} linked sales · {evidenceLabel(brand.evidence)}</small>
                    </span>
                    <span className="bp-brand-score">{brand.cashEfficiencyScore}</span>
                  </button>
                  <div className="bp-brand-metrics">
                    <div><span>Realised profit</span><strong>{brand.completedSales ? formatFinanceMoney(brand.realisedProfit) : 'No evidence'}</strong></div>
                    <div><span>ROI</span><strong>{brand.realisedRoi === undefined ? `${brand.averageForecastRoi.toFixed(0)}% forecast` : `${brand.realisedRoi.toFixed(0)}% realised`}</strong></div>
                    <div><span>Sell time</span><strong>{brand.averageDaysToSell === undefined ? 'Unknown' : `${brand.averageDaysToSell.toFixed(0)} days`}</strong></div>
                    <div><span>Cash tied</span><strong>{formatFinanceMoney(brand.activeCost)}</strong></div>
                  </div>
                  <div className={`bp-recommendation tone-${recommendationTone(brand.recommendation)}`}>
                    <strong>{brand.recommendation}</strong>
                    <span>{brand.recommendationReason}</span>
                  </div>
                  {selectedBrand === brand.brand && (
                    <div className="bp-brand-details">
                      <div><span>Average buy</span><strong>{formatFinanceMoney(brand.averageBuyPrice)}</strong></div>
                      <div><span>Average sale</span><strong>{brand.averageSalePrice === undefined ? 'No linked sales' : formatFinanceMoney(brand.averageSalePrice)}</strong></div>
                      <div><span>Average realised profit</span><strong>{brand.averageRealisedProfit === undefined ? 'No linked sales' : formatFinanceMoney(brand.averageRealisedProfit)}</strong></div>
                      <div><span>Sell-through</span><strong>{brand.sellThroughRate.toFixed(0)}%</strong></div>
                      <div><span>Forecast profit</span><strong>{formatFinanceMoney(brand.forecastProfit)}</strong></div>
                      <div><span>90+ day cash</span><strong>{formatFinanceMoney(brand.aged90Cost)}</strong></div>
                      <div><span>Top category</span><strong>{brand.topCategory ?? 'Not enough data'}</strong></div>
                      <div><span>Top size</span><strong>{brand.topSize ?? 'Not enough data'}</strong></div>
                      {brand.warnings.length > 0 && (
                        <p>{brand.warnings.join(' · ')}</p>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {view === 'recommendations' && (
        <section className="panel">
          <SectionHeader
            eyebrow="BUYING RECOMMENDATIONS"
            title="Where sourcing should increase, hold or reduce"
            action={<JosButton variant="secondary" onClick={onOpenSourceCheck}>Open SourceCheck</JosButton>}
          />
          <div className="bp-recommendation-groups">
            {(['Buy More', 'Hold', 'Reduce Buying', 'Exit Brand'] as BrandRecommendation[]).map(recommendation => (
              <section key={recommendation}>
                <h3>{recommendation} <span>{report.recommendationCounts[recommendation]}</span></h3>
                {report.brands.filter(brand => brand.recommendation === recommendation).length === 0 ? (
                  <p>No brands currently meet this evidence rule.</p>
                ) : (
                  report.brands
                    .filter(brand => brand.recommendation === recommendation)
                    .map(brand => (
                      <button type="button" key={brand.brand} onClick={() => { setView('leaderboard'); setSelectedBrand(brand.brand) }}>
                        <span><strong>{brand.brand}</strong><small>{brand.recommendationReason}</small></span>
                        <em>{brand.cashEfficiencyScore}/100</em>
                      </button>
                    ))
                )}
              </section>
            ))}
          </div>
        </section>
      )}

      {view === 'cash' && (
        <section className="panel">
          <SectionHeader
            eyebrow="BRAND CASH LOCK"
            title="Which brands are holding purchase cash"
            description="Aged cash is active stock with recorded age of at least 60 or 90 days."
            action={<JosButton variant="ghost" onClick={onOpenInventory}>Open Inventory</JosButton>}
          />
          <div className="bp-cash-list">
            {[...report.brands]
              .sort((a, b) => b.activeCost - a.activeCost)
              .map(brand => (
                <article key={brand.brand}>
                  <div>
                    <strong>{brand.brand}</strong>
                    <small>{brand.activeItems} active · Oldest {brand.oldestActiveDays === undefined ? 'unknown' : `${brand.oldestActiveDays} days`}</small>
                  </div>
                  <div><span>Total cash</span><strong>{formatFinanceMoney(brand.activeCost)}</strong></div>
                  <div><span>60+ days</span><strong>{formatFinanceMoney(brand.aged60Cost)}</strong></div>
                  <div><span>90+ days</span><strong>{formatFinanceMoney(brand.aged90Cost)}</strong></div>
                </article>
              ))}
          </div>
        </section>
      )}

      {view === 'evidence' && (
        <>
          <section className="panel">
            <SectionHeader eyebrow="EVIDENCE QUALITY" title="What supports the recommendations" compact />
            <div className="bp-evidence-grid">
              <div><span>Linked sales used</span><strong>{report.dataQuality.linkedSales}</strong></div>
              <div><span>Unlinked sales excluded</span><strong>{report.dataQuality.unlinkedSales}</strong></div>
              <div><span>Duplicate sale links</span><strong>{report.dataQuality.duplicateSaleLinks}</strong></div>
              <div><span>Sold stock without linked sale</span><strong>{report.dataQuality.soldItemsWithoutLinkedSale}</strong></div>
              <div><span>Sale date coverage</span><strong>{report.dataQuality.saleDateCoverage.toFixed(0)}%</strong></div>
            </div>
            <JosButton variant="secondary" fullWidth onClick={onOpenFinance}>Review Finance ledger</JosButton>
          </section>

          <section className="bp-evidence-notes">
            <p className="eyebrow">ENGINE RULES</p>
            {report.evidenceNotes.map(note => <p key={note}>{note}</p>)}
          </section>
        </>
      )}
    </main>
  )
}
