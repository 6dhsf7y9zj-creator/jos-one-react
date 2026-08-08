import type { BusinessEvent } from './BusinessEvents.ts'

type Listener = (event: BusinessEvent) => void

const listeners = new Set<Listener>()
const AUDIT_KEY = 'jos-one-core-audit-trail'
const MAX_AUDIT_EVENTS = 250

function readAudit(): BusinessEvent[] {
  try {
    const value = localStorage.getItem(AUDIT_KEY)
    return value ? JSON.parse(value) as BusinessEvent[] : []
  } catch {
    return []
  }
}

function writeAudit(events: BusinessEvent[]): void {
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(events.slice(0, MAX_AUDIT_EVENTS)))
  } catch {
    // Audit persistence must never block a business action.
  }
}

export function publishBusinessEvent(event: Omit<BusinessEvent, 'id' | 'occurredAt'>): BusinessEvent {
  const complete: BusinessEvent = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    occurredAt: new Date().toISOString(),
  }
  writeAudit([complete, ...readAudit()])
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

export function clearBusinessAuditTrail(): void {
  writeAudit([])
}

export function getAuditStorageBytes(): number {
  try {
    return new Blob([JSON.stringify(readAudit())]).size
  } catch {
    return JSON.stringify(readAudit()).length
  }
}
