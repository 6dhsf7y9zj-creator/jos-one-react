import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const financeSource = readFileSync(new URL('../components/FinanceCommandCentre.tsx', import.meta.url), 'utf8')
const operationsSource = readFileSync(new URL('../components/OperationsCommandCentre.tsx', import.meta.url), 'utf8')
const reviewSource = readFileSync(new URL('../components/CeoReviewCentre.tsx', import.meta.url), 'utf8')
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
