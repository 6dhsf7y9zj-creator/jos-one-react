import { describe, expect, it } from 'vitest'
import type { InventoryItem } from '../types/inventory.ts'
import {
  advancePipeline,
  inferPipelineStage,
  pipelineReadiness,
} from './pipeline.ts'

const item: InventoryItem = {
  sku: 'JAE-001',
  brand: 'Nike',
  category: 'Hoodie',
  description: 'Nike hoodie',
  size: 'M',
  condition: 'Very Good',
  status: 'Prep',
  grade: 'A',
  purchasePrice: 5,
  expectedSalePrice: 20,
  storageLocation: 'A1',
}

describe('Photography and listing pipeline', () => {
  it('migrates existing photographed stock into listing copy', () => {
    expect(inferPipelineStage({ ...item, status: 'Photographed' })).toBe('Listing Copy')
  })

  it('advances preparation into photography', () => {
    const advanced = advancePipeline(item)
    expect(advanced.pipelineStage).toBe('Photography')
    expect(advanced.status).toBe('Prep')
  })

  it('calculates full readiness for a completed live item', () => {
    const complete = {
      ...item,
      status: 'Live' as const,
      pipelineStage: 'Live' as const,
      photoChecklist: {
        front: true, back: true, brandLabel: true, sizeLabel: true,
        careLabel: true, measurements: true, defects: true,
      },
      listingChecklist: {
        title: true, description: true, measurements: true,
        condition: true, price: true, platform: true,
      },
    }
    expect(pipelineReadiness(complete)).toBe(100)
  })
})
