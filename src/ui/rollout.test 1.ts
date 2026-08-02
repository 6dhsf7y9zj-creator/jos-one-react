import { describe, expect, it } from 'vitest'
import financeSource from '../components/FinanceCommandCentre.tsx?raw'
import operationsSource from '../components/OperationsCommandCentre.tsx?raw'
import reviewSource from '../components/CeoReviewCentre.tsx?raw'

describe('JOS v2.1 design system rollout', () => {
  it('uses shared KPI cards in the three command centres', () => {
    expect(financeSource).toContain('<KpiCard')
    expect(operationsSource).toContain('<KpiCard')
    expect(reviewSource).toContain('<KpiCard')
  })

  it('uses shared actions, notices and empty states', () => {
    expect(financeSource).toContain('<NoticeCard')
    expect(financeSource).toContain('<JosButton')
    expect(operationsSource).toContain('<EmptyState')
    expect(reviewSource).toContain('<SectionHeader')
  })
})
