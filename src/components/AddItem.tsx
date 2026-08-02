import { useMemo, useState } from 'react'
import { generateSku } from '../lib/inventory'
import type { InventoryItem, JosSettings } from '../types/inventory'

type Props = {
  items: InventoryItem[]
  settings: JosSettings
  onSave: (item: InventoryItem) => void
}

export function AddItem({ items, settings, onSave }: Props) {
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('Hoodie')
  const [description, setDescription] = useState('')
  const [size, setSize] = useState('')
  const [condition, setCondition] = useState('Very Good')
  const [grade, setGrade] = useState<InventoryItem['grade']>('B')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [expectedSalePrice, setExpectedSalePrice] = useState('')
  const [storageLocation, setStorageLocation] = useState(settings.storageLocations[0] ?? 'TBC')
  const [message, setMessage] = useState('')

  const purchase = Number(purchasePrice) || 0
  const expected = Number(expectedSalePrice) || 0
  const profit = expected - purchase
  const roi = purchase > 0 ? (profit / purchase) * 100 : 0
  const sku = useMemo(() => generateSku(items), [items])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!brand.trim() || !description.trim() || purchase <= 0 || expected <= 0) {
      setMessage('Complete the brand, description and both price fields.')
      return
    }

    onSave({
      sku,
      brand: brand.trim(),
      category,
      description: description.trim(),
      size: size.trim() || 'N/A',
      condition,
      status: 'Prep',
      grade,
      purchasePrice: purchase,
      expectedSalePrice: expected,
      storageLocation,
    })
  }

  return (
    <main className="screen form-screen">
      <section className="panel form-intro">
        <p className="eyebrow">NEW INVENTORY</p>
        <h2>Add a stock item</h2>
        <p>JOS will assign <strong>{sku}</strong> and place the item into Prep.</p>
      </section>

      <form className="panel item-form" onSubmit={submit}>
        <label>Brand<input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Nike" /></label>
        <label>Category
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option>Hoodie</option><option>T-shirt</option><option>Jeans</option>
            <option>Jacket</option><option>Sweatshirt</option><option>Other</option>
          </select>
        </label>
        <label className="full">Description<input value={description} onChange={e => setDescription(e.target.value)} placeholder="Navy embroidered hoodie" /></label>
        <label>Size<input value={size} onChange={e => setSize(e.target.value)} placeholder="M" /></label>
        <label>Condition
          <select value={condition} onChange={e => setCondition(e.target.value)}>
            <option>New with Tags</option><option>Excellent</option><option>Very Good</option>
            <option>Good</option><option>Satisfactory</option>
          </select>
        </label>
        <label>Stock grade
          <select value={grade} onChange={e => setGrade(e.target.value as InventoryItem['grade'])}>
            <option value="A">A</option><option value="B">B</option>
            <option value="C">C</option><option value="Exit">Exit</option>
          </select>
        </label>
        <label>Storage
          <select value={storageLocation} onChange={e => setStorageLocation(e.target.value)}>
            {settings.storageLocations.map(location => <option key={location}>{location}</option>)}
            <option>TBC</option>
          </select>
        </label>
        <label>Purchase price (£)<input inputMode="decimal" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="8.50" /></label>
        <label>Expected sale (£)<input inputMode="decimal" value={expectedSalePrice} onChange={e => setExpectedSalePrice(e.target.value)} placeholder="24.99" /></label>

        <div className="form-calculation full">
          <div><span>Expected profit</span><strong>£{profit.toFixed(2)}</strong></div>
          <div><span>ROI</span><strong>{roi.toFixed(0)}%</strong></div>
        </div>

        {message && <p className="form-message full">{message}</p>}
        <button type="submit" className="primary-action full">Save item</button>
      </form>
    </main>
  )
}
