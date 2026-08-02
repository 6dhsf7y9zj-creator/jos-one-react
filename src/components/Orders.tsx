import type { OrderRecord } from '../types/inventory'

export function Orders({ orders }: { orders: OrderRecord[] }) {
  return (
    <main className="screen orders-screen">
      <section className="panel orders-hero">
        <p className="eyebrow">FULFILMENT</p>
        <h2>{orders.length} {orders.length === 1 ? 'order' : 'orders'} ready</h2>
        <p>Keep sold stock visible until it has been packed and dispatched.</p>
      </section>

      {orders.length === 0 ? (
        <section className="panel empty-state">
          <h2>No active orders</h2>
          <p>Restored or newly recorded orders will appear here.</p>
        </section>
      ) : (
        <section className="orders-list">
          {orders.map(order => (
            <article className="panel order-card" key={order.id}>
              <div>
                <p className="eyebrow">{order.sku}</p>
                <h3>{order.item}</h3>
              </div>
              <span className="order-status">{order.status}</span>
              <dl>
                <div><dt>Deadline</dt><dd>{order.deadline || 'Not set'}</dd></div>
                <div><dt>Order ID</dt><dd>{order.id}</dd></div>
              </dl>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
