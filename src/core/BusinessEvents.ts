export type BusinessEventType =
  | 'inventory.created'
  | 'inventory.updated'
  | 'inventory.deleted'
  | 'orders.updated'
  | 'finance.updated'
  | 'settings.updated'
  | 'backup.restored'
  | 'diagnostics.checked'
  | 'audit.exported'
  | 'audit.cleared'
  | 'inventory.bulk-updated'

export type BusinessEvent = {
  id: string
  type: BusinessEventType
  occurredAt: string
  summary: string
  entityId?: string
  metadata?: Record<string, string | number | boolean | undefined>
}
