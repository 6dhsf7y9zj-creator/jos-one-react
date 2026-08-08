import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const inventorySource = readFileSync(new URL('./components/Inventory.tsx', import.meta.url), 'utf8')
const editorSource = readFileSync(new URL('./components/InventoryEditCentre.tsx', import.meta.url), 'utf8')
const coreSource = readFileSync(new URL('./core/JOSCore.ts', import.meta.url), 'utf8')

describe('Inventory Edit Centre integration', () => {
  it('replaces modal editing with a dedicated route', () => {
    expect(appSource).toContain("tab === 'inventory-edit'")
    expect(appSource).toContain('<InventoryEditCentre')
    expect(inventorySource).toContain('onEdit(item.sku)')
    expect(inventorySource).not.toContain('inventory-editor-overlay')
  })

  it('tracks the original SKU and cascades SKU changes through JOS Core', () => {
    expect(appSource).toContain('saveEditedItem = (originalSku: string')
    expect(appSource).toContain('saveInventoryThroughCore(items, orders, settings, originalSku, updated)')
    expect(coreSource).toContain('order.sku === originalSku')
    expect(coreSource).toContain('transaction.sku === originalSku')
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
