import type { BusinessEvent } from './BusinessEvents.ts'

type Listener = (event: BusinessEvent) => void

const listeners = new Set<Listener>()
const AUDIT_KEY = 'jos-one-core-audit-trail'

function readAudit(): BusinessEvent[] {
  try {
    const value = localStorage.getItem(AUDIT_KEY)
    return value ? JSON.parse(value) as BusinessEvent[] : []
  } catch {
    return []
  }
}

export function publishBusinessEvent(event: Omit<BusinessEvent, 'id' | 'occurredAt'>): BusinessEvent {
  const complete: BusinessEvent = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    occurredAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify([complete, ...readAudit()].slice(0, 100)))
  } catch {
    // Audit persistence must never block a business action.
  }
  listeners.forEach(listener => listener(complete))
  return complete
}

export function subscribeBusinessEvents(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getBusinessAuditTrail(): BusinessEvent[] {
  return readAudit()
}
