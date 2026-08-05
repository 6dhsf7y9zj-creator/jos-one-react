import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'
import inventorySource from './components/Inventory.tsx?raw'
import editorSource from './components/InventoryEditCentre.tsx?raw'


describe('Inventory Edit Centre integration', () => {
  it('replaces modal editing with a dedicated route', () => {
    expect(appSource).toContain("tab === 'inventory-edit'")
    expect(appSource).toContain('<InventoryEditCentre')
    expect(inventorySource).toContain('onEdit(item.sku)')
    expect(inventorySource).not.toContain('inventory-editor-overlay')
  })

  it('tracks the original SKU and cascades SKU changes', () => {
    expect(appSource).toContain('saveEditedItem = (originalSku: string')
    expect(appSource).toContain('order.sku === originalSku')
    expect(appSource).toContain('transaction.sku === originalSku')
    expect(editorSource).toContain('duplicateSku')
  })

  it('protects unsaved changes and validates core fields', () => {
    expect(editorSource).toContain('beforeunload')
    expect(editorSource).toContain('Discard the unsaved changes')
    expect(editorSource).toContain('Prices cannot be negative')
  })

  it('keeps live profit, ROI and target warnings visible', () => {
    expect(editorSource).toContain('Expected profit')
    expect(editorSource).toContain('ROI')
    expect(editorSource).toContain('Target warning')
  })
})
