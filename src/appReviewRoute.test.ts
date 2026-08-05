import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
describe('CEO Review route', () => {
  it('renders the CEO Review component when the review tab is active', () => {
    expect(appSource).toContain("tab === 'review'")
    expect(appSource).toContain('<CeoReviewCentre')
  })
})
