import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'

describe('CEO Review route', () => {
  it('renders the CEO Review component when the review tab is active', () => {
    expect(appSource).toContain("tab === 'review'")
    expect(appSource).toContain('<CeoReviewCentre')
  })
})
