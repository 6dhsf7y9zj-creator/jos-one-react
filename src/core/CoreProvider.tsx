import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { InventoryItem, JosSettings, OrderRecord } from '../types/inventory.ts'
import { calculateSystemHealth } from './SystemHealth.ts'
import { buildDataHubSnapshot } from './DataHub.ts'

type CoreContextValue = {
  items: InventoryItem[]
  orders: OrderRecord[]
  settings: JosSettings
  systemHealth: ReturnType<typeof calculateSystemHealth>
  dataHub: ReturnType<typeof buildDataHubSnapshot>
}

const CoreContext = createContext<CoreContextValue | undefined>(undefined)

export function CoreProvider({ items, orders, settings, children }: Omit<CoreContextValue, 'systemHealth' | 'dataHub'> & { children: ReactNode }) {
  const systemHealth = useMemo(() => calculateSystemHealth(items, orders, settings), [items, orders, settings])
  const dataHub = useMemo(() => buildDataHubSnapshot(items, orders, settings), [items, orders, settings])
  const value = useMemo(() => ({ items, orders, settings, systemHealth, dataHub }), [items, orders, settings, systemHealth, dataHub])
  return <CoreContext.Provider value={value}>{children}</CoreContext.Provider>
}

export function useJOSCore(): CoreContextValue {
  const value = useContext(CoreContext) as CoreContextValue | undefined
  if (!value) throw new Error('useJOSCore must be used inside CoreProvider')
  return value
}
