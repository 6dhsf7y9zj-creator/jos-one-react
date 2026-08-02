import { describe, expect, it } from 'vitest'
import addItemSource from './components/AddItem.tsx?raw'
import backupSource from './components/BackupCenter.tsx?raw'
import brandSource from './components/BrandPerformanceCentre.tsx?raw'
import intelligenceSource from './components/BusinessIntelligence.tsx?raw'
import reviewSource from './components/CeoReviewCentre.tsx?raw'
import dashboardSource from './components/Dashboard.tsx?raw'
import financeSource from './components/FinanceCommandCentre.tsx?raw'
import inventorySource from './components/Inventory.tsx?raw'
import inventoryIntelligenceSource from './components/InventoryIntelligenceEngine.tsx?raw'
import operationsSource from './components/OperationsCommandCentre.tsx?raw'
import ordersSource from './components/Orders.tsx?raw'
import pipelineSource from './components/PhotographyListingPipeline.tsx?raw'
import sourceCheckSource from './components/SourceCheck.tsx?raw'

describe('App component completeness', () => {
  it('includes every component imported by App.tsx', () => {
    expect(addItemSource).toContain('export function AddItem')
    expect(backupSource).toContain('export function BackupCenter')
    expect(brandSource).toContain('export function BrandPerformanceCentre')
    expect(intelligenceSource).toContain('export function BusinessIntelligence')
    expect(reviewSource).toContain('export function CeoReviewCentre')
    expect(dashboardSource).toContain('export function Dashboard')
    expect(financeSource).toContain('export function FinanceCommandCentre')
    expect(inventorySource).toContain('export function Inventory')
    expect(inventoryIntelligenceSource).toContain('export function InventoryIntelligenceEngine')
    expect(operationsSource).toContain('export function OperationsCommandCentre')
    expect(ordersSource).toContain('export function Orders')
    expect(pipelineSource).toContain('export function PhotographyListingPipeline')
    expect(sourceCheckSource).toContain('export function SourceCheck')
  })
})
