import { useMemo, useState } from 'react'
import type { InventoryItem, OrderRecord, OrderStatus } from '../types/inventory'
import { advanceOrder, calculateOrderMetrics, customerSummaries, isActiveOrder, orderInventoryStatus, orderStages } from '../lib/orders'

type Props = {
  orders: OrderRecord[]
  items: InventoryItem[]
  onChange: (orders: OrderRecord[]) => void
  onUpdateItem: (item: InventoryItem) => void
}

const emptyDraft = (): OrderRecord => ({
  id: `ORD-${Date.now()}`,
  sku: '', item: '', status: 'Paid', deadline: '', platform: 'Vinted',
  placedAt: new Date().toISOString(),
})

function money(value?: number) { return `£${(value || 0).toFixed(2)}` }

export function Orders({ orders, items, onChange, onUpdateItem }: Props) {
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'active'|'all'|'customers'>('active')
  const [editing, setEditing] = useState<OrderRecord | null>(null)
  const metrics = useMemo(() => calculateOrderMetrics(orders), [orders])
  const customers = useMemo(() => customerSummaries(orders), [orders])
  const visible = orders.filter(order => view === 'all' || (view === 'active' && isActiveOrder(order)))
    .filter(order => !query.trim() || [order.id, order.sku, order.item, order.buyerName, order.buyerUsername, order.trackingNumber]
      .join(' ').toLowerCase().includes(query.toLowerCase()))

  const save = () => {
    if (!editing || !editing.id.trim() || !editing.sku.trim()) return
    const exists = orders.some(order => order.id === editing.id)
    onChange(exists ? orders.map(order => order.id === editing.id ? editing : order) : [editing, ...orders])
    const item = items.find(value => value.sku === editing.sku)
    const stockStatus = orderInventoryStatus(editing)
    if (item && stockStatus) onUpdateItem({ ...item, status: stockStatus, actualSalePrice: editing.salePrice ?? item.actualSalePrice, dateSold: item.dateSold || editing.placedAt?.slice(0,10) })
    setEditing(null)
  }

  const progress = (order: OrderRecord) => {
    const updated = advanceOrder(order)
    onChange(orders.map(value => value.id === order.id ? updated : value))
    const item = items.find(value => value.sku === order.sku)
    const stockStatus = orderInventoryStatus(updated)
    if (item && stockStatus) onUpdateItem({ ...item, status: stockStatus, actualSalePrice: updated.salePrice ?? item.actualSalePrice, dateSold: item.dateSold || updated.placedAt?.slice(0,10) })
  }

  return (
    <main className="screen customer-orders-centre">
      <section className="orders-command-hero">
        <div><p className="eyebrow">CUSTOMER & ORDERS COMMAND CENTRE</p><h2>Control every sale through delivery</h2><p>Customer details are only as complete as the information you record. JOS does not pull private buyer data from Vinted.</p></div>
        <button type="button" onClick={() => setEditing(emptyDraft())}>＋ Add order</button>
      </section>

      <section className="orders-command-kpis">
        <div><span>Dispatch waiting</span><strong>{metrics.dispatchWaiting}</strong></div>
        <div><span>Active orders</span><strong>{metrics.active}</strong></div>
        <div><span>Recorded revenue</span><strong>{money(metrics.revenue)}</strong></div>
        <div><span>Average order</span><strong>{money(metrics.averageOrderValue)}</strong></div>
        <div><span>Repeat customers</span><strong>{metrics.repeatCustomers}</strong></div>
        <div><span>Returns / refunds</span><strong>{metrics.returns}</strong></div>
      </section>

      <section className="panel orders-command-controls">
        <input className="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search order, SKU, buyer or tracking" />
        <div><button className={view==='active'?'active':''} onClick={() => setView('active')}>Active</button><button className={view==='all'?'active':''} onClick={() => setView('all')}>All orders</button><button className={view==='customers'?'active':''} onClick={() => setView('customers')}>Customers</button></div>
      </section>

      {view === 'customers' ? <section className="orders-customer-list">
        {customers.length === 0 ? <div className="panel empty-state"><h2>No customer records</h2><p>Add buyer details to orders to build customer history.</p></div> : customers.map(customer => <article className="panel customer-summary" key={(customer.username||customer.name).toLowerCase()}><div><p className="eyebrow">{customer.orders > 1 ? 'REPEAT CUSTOMER' : 'CUSTOMER'}</p><h3>{customer.name}</h3><p>{customer.username ? `@${customer.username}` : 'Username not recorded'}</p></div><dl><div><dt>Orders</dt><dd>{customer.orders}</dd></div><div><dt>Revenue</dt><dd>{money(customer.revenue)}</dd></div><div><dt>Platforms</dt><dd>{customer.platforms.join(', ') || 'Not recorded'}</dd></div></dl></article>)}
      </section> : <section className="orders-command-list">
        {visible.length === 0 ? <div className="panel empty-state"><h2>No matching orders</h2><p>Add an order or change the current filter.</p></div> : visible.map(order => {
          const next = orderStages[orderStages.indexOf(order.status as OrderStatus)+1]
          return <article className="order-command-card" key={order.id}>
            <div className="order-command-heading"><div><p className="eyebrow">{order.id} · {order.sku}</p><h3>{order.item}</h3><p>{order.buyerName || order.buyerUsername || 'Buyer not recorded'} · {order.platform || 'Platform not recorded'}</p></div><span>{order.status}</span></div>
            <div className="order-command-facts"><div><span>Sale</span><strong>{money(order.salePrice)}</strong></div><div><span>Deadline</span><strong>{order.deadline || 'Not set'}</strong></div><div><span>Tracking</span><strong>{order.trackingNumber || 'Not added'}</strong></div></div>
            <div className="order-command-actions"><button onClick={() => setEditing({...order})}>Edit details</button>{next && <button className="primary" onClick={() => progress(order)}>Move to {next}</button>}</div>
          </article>
        })}
      </section>}

      {editing && <section className="order-editor-overlay"><form className="order-editor" onSubmit={e => {e.preventDefault(); save()}}><div className="editor-header"><div><p className="eyebrow">ORDER RECORD</p><h2>{orders.some(o=>o.id===editing.id)?'Edit order':'Add order'}</h2></div><button type="button" onClick={() => setEditing(null)}>×</button></div>
        <div className="order-form-grid">
          <label>Order ID<input value={editing.id} onChange={e=>setEditing({...editing,id:e.target.value})}/></label>
          <label>SKU<select value={editing.sku} onChange={e=>{const item=items.find(i=>i.sku===e.target.value);setEditing({...editing,sku:e.target.value,item:item?`${item.brand} ${item.category}`:editing.item})}}><option value="">Select item</option>{items.map(item=><option key={item.sku} value={item.sku}>{item.sku} · {item.brand} {item.category}</option>)}</select></label>
          <label>Item<input value={editing.item} onChange={e=>setEditing({...editing,item:e.target.value})}/></label>
          <label>Status<select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})}>{[...orderStages,'Return requested','Returned','Refunded','Cancelled'].map(value=><option key={value}>{value}</option>)}</select></label>
          <label>Buyer name<input value={editing.buyerName||''} onChange={e=>setEditing({...editing,buyerName:e.target.value})}/></label>
          <label>Buyer username<input value={editing.buyerUsername||''} onChange={e=>setEditing({...editing,buyerUsername:e.target.value})}/></label>
          <label>Platform<input value={editing.platform||''} onChange={e=>setEditing({...editing,platform:e.target.value})}/></label>
          <label>Sale price<input type="number" step="0.01" value={editing.salePrice??''} onChange={e=>setEditing({...editing,salePrice:e.target.value===''?undefined:Number(e.target.value)})}/></label>
          <label>Dispatch deadline<input value={editing.deadline} onChange={e=>setEditing({...editing,deadline:e.target.value})}/></label>
          <label>Carrier<input value={editing.carrier||''} onChange={e=>setEditing({...editing,carrier:e.target.value})}/></label>
          <label className="wide">Tracking number<input value={editing.trackingNumber||''} onChange={e=>setEditing({...editing,trackingNumber:e.target.value})}/></label>
          <label className="wide">Notes<textarea value={editing.notes||''} onChange={e=>setEditing({...editing,notes:e.target.value})}/></label>
        </div><button className="primary-action" type="submit">Save order</button></form></section>}
    </main>
  )
}
